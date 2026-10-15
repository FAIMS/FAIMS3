// SPDX-License-Identifier: Apache-2.0
/**
 * Map layer library: upload, processing status, survey links, and
 * presigned download-url grants.
 */

import {
  Action,
  GetMapAssetDownloadUrlResponse,
  GetMapAssetListResponse,
  GetMapAssetResponse,
  IdInputSchema,
  INPUT_LIMITS,
  mapAssetUploadTooLargeMessage,
  MapAssetDetailsSchema,
  PostMapAssetLinkInputSchema,
} from '@faims3/data-model';
import {randomUUID} from 'crypto';
import express, {NextFunction, Request, Response} from 'express';
import {mkdir, rm} from 'fs/promises';
import multer from 'multer';
import {tmpdir} from 'os';
import path from 'path';
import {z} from 'zod';
import {
  createMapAsset,
  deleteMapAsset,
  enqueueMapAssetProcessing,
  getMapAsset,
  linkMapAsset,
  listAssetsByCreator,
  listAssetsByTeam,
  listLinkAssetIds,
  listLinkProjectIds,
  presignNormalizedAttachment,
  replaceMapAssetFiles,
  unlinkMapAsset,
  updateMapAssetDetails,
} from '../couchdb/mapAssets/store';
import {assertMapUploadDiskAvailable} from '../couchdb/mapAssets/diskSpace';
import {
  assertUploadCompanions,
  primaryUploadFile,
  safeUploadFilename,
  UploadedMapFile,
} from '../couchdb/mapAssets/normalize';
import {getAllTeams} from '../couchdb/teams';
import * as Exceptions from '../exceptions';
import {
  inviteAuditFromRequest,
  logMapAssetProcessing,
  withMapAssetProcessingWait,
} from '../logging';
import {requireAuthenticationAPI, userCanDo} from '../middleware';
import validate from '../middleware/validate';
import patch from '../utils/patchExpressAsync';

patch();

type MapUploadRequest = Request & {
  mapUploadDir?: string;
  mapUploadId?: string;
};

function requestUploadDir(req: Request): string | undefined {
  return (req as MapUploadRequest).mapUploadDir;
}

function requestUploadId(req: Request): string | undefined {
  return (req as MapUploadRequest).mapUploadId;
}

async function cleanupRequestUpload(req: Request): Promise<void> {
  const dir = requestUploadDir(req);
  if (!dir) {
    return;
  }
  await rm(dir, {recursive: true, force: true}).catch(() => undefined);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => {
      const existing = requestUploadDir(req);
      if (existing) {
        callback(null, existing);
        return;
      }
      const uploadId = requestUploadId(req) ?? `req-${randomUUID()}`;
      const dir = path.join(tmpdir(), 'faims-map-uploads', uploadId);
      mkdir(dir, {recursive: true})
        .then(() => {
          (req as MapUploadRequest).mapUploadDir = dir;
          callback(null, dir);
        })
        .catch(error => callback(error, dir));
    },
    filename: (_req, file, callback) => {
      try {
        callback(null, safeUploadFilename(file.originalname));
      } catch (error) {
        callback(error as Error, '');
      }
    },
  }),
  limits: {
    fileSize: INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES,
    files: INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES,
  },
});

function multerUploadError(error: unknown): Error {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new Exceptions.InvalidRequestException(
        mapAssetUploadTooLargeMessage()
      );
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return new Exceptions.InvalidRequestException(
        `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`
      );
    }
    return new Exceptions.InvalidRequestException(error.message);
  }
  return error instanceof Error ? error : new Error('Upload was not accepted.');
}

function acceptMapAssetFiles(req: Request, res: Response, next: NextFunction) {
  const uploadId = `req-${randomUUID()}`;
  (req as MapUploadRequest).mapUploadId = uploadId;
  req.once('aborted', () => {
    logMapAssetProcessing({
      event: 'upload.receive',
      outcome: 'failure',
      uploadId,
      userId: req.user?.user_id,
      reason: 'client aborted the upload',
      ...inviteAuditFromRequest(req),
    });
    void cleanupRequestUpload(req);
  });
  void (async () => {
    try {
      await assertMapUploadDiskAvailable();
      await withMapAssetProcessingWait(
        {
          event: 'upload.receive',
          uploadId,
          userId: req.user?.user_id,
          ...inviteAuditFromRequest(req),
        },
        () =>
          new Promise<void>((resolve, reject) => {
            upload.array('files', INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES)(
              req,
              res,
              (error: unknown) => {
                if (error) {
                  reject(multerUploadError(error));
                  return;
                }
                resolve();
              }
            );
          })
      );
      next();
    } catch (error) {
      await cleanupRequestUpload(req);
      next(error as Error);
    }
  })();
}

function uploadedFileSummary(files: UploadedMapFile[]): {
  fileCount: number;
  filenames: string[];
  byteSize: number;
  filename: string;
} {
  return {
    fileCount: files.length,
    filenames: files.map(file => file.filename),
    byteSize: files.reduce(
      (sum, file) => sum + (file.size ?? file.bytes?.length ?? 0),
      0
    ),
    filename: files[0]?.filename ?? '',
  };
}

export const api: express.Router = express.Router();

function requireUser(req: express.Request) {
  if (!req.user) {
    throw new Exceptions.UnauthorizedException();
  }
  return req.user;
}

function canUpload(user: Express.User, teamId?: string): boolean {
  if (teamId) {
    return userCanDo({
      user,
      action: Action.CREATE_PROJECT_IN_TEAM,
      resourceId: teamId,
    });
  }
  return userCanDo({user, action: Action.CREATE_PROJECT});
}

async function canReadAsset(
  user: Express.User,
  asset: {createdBy: string; ownedByTeamId?: string; _id: string}
): Promise<boolean> {
  if (!asset.ownedByTeamId && asset.createdBy === user.user_id) {
    return true;
  }
  if (
    asset.ownedByTeamId &&
    userCanDo({
      user,
      action: Action.VIEW_TEAM_DETAILS,
      resourceId: asset.ownedByTeamId,
    })
  ) {
    return true;
  }
  const projectIds = await listLinkProjectIds(asset._id);
  return projectIds.some(projectId =>
    userCanDo({
      user,
      action: Action.READ_PROJECT_METADATA,
      resourceId: projectId,
    })
  );
}

function canAdministerProject(user: Express.User, projectId: string): boolean {
  return userCanDo({
    user,
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });
}

function canDelete(
  user: Express.User,
  asset: {createdBy: string; ownedByTeamId?: string}
): boolean {
  if (!asset.ownedByTeamId) {
    return asset.createdBy === user.user_id;
  }
  return userCanDo({
    user,
    action: Action.UPDATE_TEAM_DETAILS,
    resourceId: asset.ownedByTeamId,
  });
}

function parseDetails(
  name: string,
  description: string
): {
  name: string;
  description: string;
} {
  const parsed = MapAssetDetailsSchema.safeParse({name, description});
  if (!parsed.success) {
    throw new Exceptions.InvalidRequestException(
      parsed.error.issues[0]?.message ?? 'Map layer details are not valid.'
    );
  }
  return parsed.data;
}

function filesFromRequest(req: express.Request): UploadedMapFile[] {
  const uploaded = req.files;
  const list = Array.isArray(uploaded) ? uploaded : [];
  if (list.length === 0) {
    throw new Exceptions.InvalidRequestException(
      'Choose a map file to upload.'
    );
  }
  if (list.length > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES) {
    throw new Exceptions.InvalidRequestException(
      `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`
    );
  }
  const total = list.reduce((sum, file) => sum + file.size, 0);
  if (total > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES) {
    throw new Exceptions.InvalidRequestException(
      mapAssetUploadTooLargeMessage()
    );
  }
  try {
    return list.map(file => ({
      filename: safeUploadFilename(file.originalname),
      diskPath: file.path,
      size: file.size,
    }));
  } catch (error) {
    throw new Exceptions.InvalidRequestException(
      error instanceof Error ? error.message : 'Upload was not accepted.'
    );
  }
}

function assertFiles(files: UploadedMapFile[]): UploadedMapFile[] {
  try {
    assertUploadCompanions(files);
    primaryUploadFile(files);
  } catch (error) {
    throw new Exceptions.InvalidRequestException(
      error instanceof Error ? error.message : 'Upload was not accepted.'
    );
  }
  return files;
}

api.get(
  '/',
  requireAuthenticationAPI,
  validate({
    query: z.object({
      teamId: IdInputSchema.min(1).optional(),
      projectId: IdInputSchema.min(1).optional(),
    }),
  }),
  async (req, res: Response<GetMapAssetListResponse>) => {
    const user = requireUser(req);
    const {teamId, projectId} = req.query;

    if (projectId) {
      if (
        !userCanDo({
          user,
          action: Action.READ_PROJECT_METADATA,
          resourceId: projectId,
        })
      ) {
        throw new Exceptions.UnauthorizedException();
      }
      const ids = await listLinkAssetIds(projectId);
      const assets = [];
      for (const id of ids) {
        const asset = await getMapAsset(id);
        if (await canReadAsset(user, asset)) {
          assets.push(asset);
        }
      }
      res.json({assets});
      return;
    }

    if (teamId) {
      if (
        !userCanDo({
          user,
          action: Action.VIEW_TEAM_DETAILS,
          resourceId: teamId,
        })
      ) {
        throw new Exceptions.UnauthorizedException();
      }
      res.json({assets: await listAssetsByTeam(teamId)});
      return;
    }

    const own = await listAssetsByCreator(user.user_id);
    const teams = await getAllTeams();
    const visibleTeams = teams.filter(team =>
      userCanDo({
        user,
        action: Action.VIEW_TEAM_DETAILS,
        resourceId: team._id,
      })
    );
    const teamAssets = (
      await Promise.all(visibleTeams.map(team => listAssetsByTeam(team._id)))
    ).flat();
    const byId = new Map<string, (typeof own)[number]>();
    for (const asset of [...own, ...teamAssets]) {
      byId.set(asset._id, asset);
    }
    res.json({assets: [...byId.values()]});
  }
);

api.post(
  '/',
  requireAuthenticationAPI,
  acceptMapAssetFiles,
  async (req, res: Response<GetMapAssetResponse>) => {
    try {
      const user = requireUser(req);
      const name =
        typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const description =
        typeof req.body?.description === 'string' ? req.body.description : '';
      const teamIdRaw =
        typeof req.body?.teamId === 'string' &&
        req.body.teamId.trim().length > 0
          ? req.body.teamId.trim()
          : undefined;
      if (
        teamIdRaw !== undefined &&
        teamIdRaw.length > INPUT_LIMITS.ID_MAX_LENGTH
      ) {
        throw new Exceptions.InvalidRequestException('Team is not valid.');
      }
      const teamId = teamIdRaw;
      const details = parseDetails(name, description);
      if (!canUpload(user, teamId)) {
        throw new Exceptions.UnauthorizedException(
          'You do not have permission to upload a map layer here.'
        );
      }
      const files = assertFiles(filesFromRequest(req));
      const primary = primaryUploadFile(files);
      const summary = uploadedFileSummary(files);
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'started',
        uploadId: requestUploadId(req),
        userId: user.user_id,
        teamId,
        method: 'POST',
        filename: primary.filename,
        fileCount: summary.fileCount,
        filenames: summary.filenames,
        byteSize: summary.byteSize,
        ...inviteAuditFromRequest(req),
      });
      const asset = await createMapAsset({
        name: details.name,
        description: details.description,
        ownedByTeamId: teamId,
        createdBy: user.user_id,
        files,
        primaryFilename: primary.filename,
      });
      enqueueMapAssetProcessing(asset._id);
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'success',
        assetId: asset._id,
        uploadId: requestUploadId(req),
        userId: user.user_id,
        teamId,
        method: 'POST',
        filename: primary.filename,
        fileCount: summary.fileCount,
        byteSize: summary.byteSize,
        ...inviteAuditFromRequest(req),
      });
      res.status(201).json(asset);
    } catch (error) {
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'failure',
        uploadId: requestUploadId(req),
        userId: req.user?.user_id,
        method: 'POST',
        reason: error instanceof Error ? error.message : String(error),
        ...inviteAuditFromRequest(req),
      });
      await cleanupRequestUpload(req);
      throw error;
    }
  }
);

api.get(
  '/:id/download-url',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string()})}),
  async (req, res: Response<GetMapAssetDownloadUrlResponse>) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!(await canReadAsset(user, asset))) {
      throw new Exceptions.UnauthorizedException();
    }
    res.json(await presignNormalizedAttachment(asset._id));
  }
);

api.get(
  '/:id',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string()})}),
  async (req, res: Response<GetMapAssetResponse>) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!(await canReadAsset(user, asset))) {
      throw new Exceptions.UnauthorizedException();
    }
    res.json(asset);
  }
);

api.patch(
  '/:id',
  requireAuthenticationAPI,
  validate({
    params: z.object({id: z.string()}),
    body: MapAssetDetailsSchema,
  }),
  async (req, res: Response<GetMapAssetResponse>) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!canDelete(user, asset)) {
      throw new Exceptions.UnauthorizedException();
    }
    const updated = await updateMapAssetDetails({
      assetId: asset._id,
      name: req.body.name,
      description: req.body.description,
    });
    res.json(updated);
  }
);

api.put(
  '/:id',
  requireAuthenticationAPI,
  acceptMapAssetFiles,
  async (req, res: Response<GetMapAssetResponse>) => {
    try {
      const user = requireUser(req);
      const asset = await getMapAsset(req.params.id);
      if (
        !(await canReadAsset(user, asset)) ||
        !canUpload(user, asset.ownedByTeamId)
      ) {
        throw new Exceptions.UnauthorizedException();
      }
      const files = assertFiles(filesFromRequest(req));
      const primary = primaryUploadFile(files);
      const summary = uploadedFileSummary(files);
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'started',
        assetId: asset._id,
        uploadId: requestUploadId(req),
        userId: user.user_id,
        teamId: asset.ownedByTeamId,
        method: 'PUT',
        filename: primary.filename,
        fileCount: summary.fileCount,
        filenames: summary.filenames,
        byteSize: summary.byteSize,
        ...inviteAuditFromRequest(req),
      });
      const replaced = await replaceMapAssetFiles({
        assetId: asset._id,
        files,
        primaryFilename: primary.filename,
      });
      enqueueMapAssetProcessing(replaced._id);
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'success',
        assetId: replaced._id,
        uploadId: requestUploadId(req),
        userId: user.user_id,
        teamId: asset.ownedByTeamId,
        method: 'PUT',
        filename: primary.filename,
        fileCount: summary.fileCount,
        byteSize: summary.byteSize,
        ...inviteAuditFromRequest(req),
      });
      res.json(replaced);
    } catch (error) {
      logMapAssetProcessing({
        event: 'upload.accept',
        outcome: 'failure',
        assetId: req.params.id,
        uploadId: requestUploadId(req),
        userId: req.user?.user_id,
        method: 'PUT',
        reason: error instanceof Error ? error.message : String(error),
        ...inviteAuditFromRequest(req),
      });
      await cleanupRequestUpload(req);
      throw error;
    }
  }
);

api.delete(
  '/:id',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string()})}),
  async (req, res) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!canDelete(user, asset)) {
      throw new Exceptions.UnauthorizedException();
    }
    await deleteMapAsset(asset._id);
    res.status(204).send();
  }
);

api.get(
  '/:id/links',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string()})}),
  async (req, res) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!(await canReadAsset(user, asset))) {
      throw new Exceptions.UnauthorizedException();
    }
    const projectIds = await listLinkProjectIds(asset._id);
    res.json({projectIds});
  }
);

api.post(
  '/:id/links',
  requireAuthenticationAPI,
  validate({
    params: z.object({id: z.string()}),
    body: PostMapAssetLinkInputSchema,
  }),
  async (req, res) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!(await canReadAsset(user, asset))) {
      throw new Exceptions.UnauthorizedException();
    }
    if (!canAdministerProject(user, req.body.projectId)) {
      throw new Exceptions.UnauthorizedException(
        'You do not have permission to add layers to this survey.'
      );
    }
    const link = await linkMapAsset({
      assetId: asset._id,
      projectId: req.body.projectId,
      linkedBy: user.user_id,
    });
    res.status(201).json(link);
  }
);

api.delete(
  '/:id/links/:projectId',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string(), projectId: z.string()})}),
  async (req, res) => {
    const user = requireUser(req);
    if (!canAdministerProject(user, req.params.projectId)) {
      throw new Exceptions.UnauthorizedException();
    }
    await unlinkMapAsset({
      assetId: req.params.id,
      projectId: req.params.projectId,
    });
    res.status(204).send();
  }
);
