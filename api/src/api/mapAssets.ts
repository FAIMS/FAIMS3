// SPDX-License-Identifier: Apache-2.0
/**
 * Map layer library: upload, processing status, survey links, and download.
 */

import {
  Action,
  GetMapAssetListResponse,
  GetMapAssetResponse,
  PostMapAssetLinkInputSchema,
  resourceNameString,
  RootDescriptionInputSchema,
} from '@faims3/data-model';
import express, {Response} from 'express';
import multer from 'multer';
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
  readNormalizedAttachment,
  replaceMapAssetFiles,
  unlinkMapAsset,
  updateMapAssetDetails,
} from '../couchdb/mapAssets/store';
import {
  assertUploadCompanions,
  primaryUploadFile,
  safeUploadFilename,
  UploadedMapFile,
} from '../couchdb/mapAssets/normalize';
import {getAllTeams} from '../couchdb/teams';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI, userCanDo} from '../middleware';
import validate from '../middleware/validate';
import patch from '../utils/patchExpressAsync';

patch();

/** Largest accepted upload. GDAL downsamples rasters before they reach a device. */
const MAP_ASSET_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;

const MapAssetDetailsSchema = z.object({
  name: resourceNameString('Layer name'),
  description: RootDescriptionInputSchema,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: MAP_ASSET_UPLOAD_MAX_BYTES, files: 8},
});

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
  return list.map(file => ({
    filename: safeUploadFilename(file.originalname),
    bytes: file.buffer,
  }));
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
      teamId: z.string().min(1).optional(),
      projectId: z.string().min(1).optional(),
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
  upload.array('files', 8),
  async (req, res: Response<GetMapAssetResponse>) => {
    const user = requireUser(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description : '';
    const teamId =
      typeof req.body?.teamId === 'string' && req.body.teamId.length > 0
        ? req.body.teamId
        : undefined;
    const details = parseDetails(name, description);
    if (!canUpload(user, teamId)) {
      throw new Exceptions.UnauthorizedException(
        'You do not have permission to upload a map layer here.'
      );
    }
    const files = assertFiles(filesFromRequest(req));
    const primary = primaryUploadFile(files);
    const asset = await createMapAsset({
      name: details.name,
      description: details.description,
      ownedByTeamId: teamId,
      createdBy: user.user_id,
      files,
      primaryFilename: primary.filename,
    });
    enqueueMapAssetProcessing(asset._id);
    res.status(201).json(asset);
  }
);

api.get(
  '/:id/normalized',
  requireAuthenticationAPI,
  validate({params: z.object({id: z.string()})}),
  async (req, res) => {
    const user = requireUser(req);
    const asset = await getMapAsset(req.params.id);
    if (!(await canReadAsset(user, asset))) {
      throw new Exceptions.UnauthorizedException();
    }
    const file = await readNormalizedAttachment(asset._id);
    res.setHeader('Content-Type', file.mediaType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.filename)}"`
    );
    res.send(file.bytes);
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
  upload.array('files', 8),
  async (req, res: Response<GetMapAssetResponse>) => {
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
    const replaced = await replaceMapAssetFiles({
      assetId: asset._id,
      files,
      primaryFilename: primary.filename,
    });
    enqueueMapAssetProcessing(replaced._id);
    res.json(replaced);
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
