/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Notebook export / download routes, mounted on the parent `/api/notebooks`
 * router. Register this router before the records CRUD router so
 * `/:id/records/export` and `/:id/records/:viewID.:format` are not captured
 * as record ids.
 */

import {
  Action,
  compileUiSpecConditionals,
  ExportFormat,
  ExportFormatSchema,
  GetExportNotebookResponse,
  getIdsByFieldName,
  getNotebookFieldTypes,
  getRecordsWithRegex,
  hasUpdatedTimeFilter,
  isPeopleUserAccountDisabled,
  queryRecordIdsByUpdated,
  UpdatedTimeFilter,
  updatedAfterMsSchema,
  updatedBeforeMsSchema,
  updatedTimeQueryRefine,
} from '@faims3/data-model';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import {upgradeCouchUserToExpressUser} from '../../auth/keySigning/create';
import {validateToken} from '../../auth/keySigning/read';
import {config} from '../../buildconfig';
import {getDataDb} from '../../couchdb';
import {
  consumeDownloadGrant,
  CreateDownloadGrantInput,
  createDownloadGrant,
  getDownloadGrant,
  verifyDownloadGrantCookieSecret,
} from '../../couchdb/downloadGrants';
import {
  generateFilenameForAttachment,
  streamNotebookFilesAsZip,
} from '../../couchdb/export/attachmentExport';
import {streamNotebookRecordsAsCSV} from '../../couchdb/export/csvExport';
import {
  generateFullExportFilename,
  streamFullExport,
} from '../../couchdb/export/fullExport';
import {assertGdalAvailable} from '../../couchdb/export/gdal';
import {
  projectHasSpatialFields,
  streamNotebookRecordsAsGeoJSON,
  streamNotebookRecordsAsGeoPackage,
  streamNotebookRecordsAsKML,
} from '../../couchdb/export/geospatialExport';
import {stripDeletedRelatedRefsFromRecordData} from '../../couchdb/export/stripDeletedRelatedRefs';
import {
  contentDispositionAttachment,
  sanitizeDownloadFilename,
} from '../../couchdb/export/utils';
import {getCompiledUiSpecModel, getUiSpecModel} from '../../couchdb/notebooks';
import {getCouchUserFromEmailOrUserId} from '../../couchdb/users';
import {
  clearDownloadGrantCookie,
  isRequestHttps,
  readDownloadGrantCookie,
  setDownloadGrantCookie,
  setDownloadNoStoreHeaders,
} from '../../downloadCookie';
import {exportRateLimit} from '../../exportRateLimiter';
import * as Exceptions from '../../exceptions';
import {inviteAuditFromRequest, logDownloadAudit} from '../../logging';
import {
  extractBearerToken,
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../../middleware';
import validate from '../../middleware/validate';
import {mockTokenContentsForUser} from '../../utils';
import {parseUpdatedTimeFilterFromQuery} from '../updatedTimeQuery';

export const notebookExportRouter: express.Router = express.Router();

// =============================================================================
// Types for download format and grant mint 
// =============================================================================

/** Optional exclusive `updatedAfter` / `updatedBefore` query (epoch-ms strings). */
const UpdatedTimeQuerySchema = z
  .object({
    updatedAfter: updatedAfterMsSchema,
    updatedBefore: updatedBeforeMsSchema,
  })
  .refine(updatedTimeQueryRefine, {
    message: 'updatedAfter must be less than updatedBefore',
  });

// Formats requiring a view ID
const REQUIRES_VIEW_ID: ExportFormat[] = ['csv'];

/**
 * Mint a single-use download grant, set the HttpOnly cookie, and respond.
 *
 * Default path returns `{ url }` rather than redirecting — hard to carefully
 * handle the auto-redirect while triggering export only once. `redirect: true`
 * is the legacy `/:id/records/:viewID.:format` path. The grant id in the URL
 * is not a capability: redeem with Bearer or the cookie set here.
 */
const mintExportDownload = async ({
  req,
  res,
  payload,
  redirect = false,
}: {
  req: Request;
  res: Response;
  payload: CreateDownloadGrantInput;
  redirect?: boolean;
}) => {
  const {grantId, secret} = await createDownloadGrant({
    ...payload,
    impersonatingUserId:
      payload.impersonatingUserId ?? req.user?.impersonatingUserId,
  });

  setDownloadGrantCookie({
    res,
    grantId,
    secret,
    secure: isRequestHttps(req),
  });

  logDownloadAudit({
    event: 'download.mint',
    outcome: 'success',
    grantId,
    userId: payload.userId,
    projectID: payload.projectID,
    format: payload.format,
    impersonatingUserId: req.user?.impersonatingUserId,
    ...inviteAuditFromRequest(req),
  });

  const url = `${config.conductorPublicUrl}/api/notebooks/download/${grantId}`;
  setDownloadNoStoreHeaders(res);
  if (redirect) {
    return res.redirect(url);
  }
  return res.json({url});
};

/**
 * Audit a failed consume and throw. `forbidden` is 403 (wrong user /
 * permission revoked); everything else is 401 so we do not confirm the
 * grant exists to an unauthenticated caller.
 */
const denyDownload = (
  req: {ip?: string; get?: (name: string) => string | undefined},
  reason: string,
  extra: {
    grantId?: string;
    auth?: 'cookie' | 'bearer';
    userId?: string;
    projectID?: string;
    format?: string;
    status?: 'unauthorized' | 'forbidden';
  } = {}
): never => {
  logDownloadAudit({
    event: 'download.consume',
    outcome: 'failure',
    reason,
    grantId: extra.grantId,
    auth: extra.auth,
    userId: extra.userId,
    projectID: extra.projectID,
    format: extra.format,
    ...inviteAuditFromRequest(req),
  });
  if (extra.status === 'forbidden') {
    throw new Exceptions.ForbiddenException(
      'You are not authorized to perform this action.'
    );
  }
  throw new Exceptions.UnauthorizedException(
    'Cannot download without a valid grant.'
  );
};

// =============================================================================
// Export Routes
// =============================================================================

/**
 * Export record data.
 *
 * Mints a single-use download grant and returns `{ url }`. The URL is not a
 * capability: redeem with the same Authorization Bearer (headless/API) or
 * the HttpOnly cookie set on this response (Control Centre window.open).
 *
 * Supported formats:
 * - csv: Requires viewID, exports tabular data for a single view
 * - zip: Optional viewID, exports attachments (all views if no viewID)
 * - geojson: Exports all spatial data as GeoJSON
 * - kml: Exports all spatial data as KML
 * - geopackage: Exports all spatial data as GeoPackage (.gpkg)
 * - full: Exports everything into a single ZIP archive
 *
 * For full exports, additional query parameters control what's included:
 * - includeTabular (default: true)
 * - includeAttachments (default: true)
 * - includeGeoJSON (default: true)
 * - includeKML (default: true)
 * - includeGeoPackage (default: true)
 * - includeMetadata (default: true)
 *
 * Optional exclusive time window (epoch-ms strings), stored on the grant:
 * - updatedAfter — record.updatedAt > this
 * - updatedBefore — record.updatedAt < this
 * Both may be omitted. When both are set, updatedAfter must be less than
 * updatedBefore.
 */
notebookExportRouter.get(
  '/:id/records/export',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  exportRateLimit,
  validate({
    query: z
      .object({
        viewID: z.string().optional(),
        format: ExportFormatSchema,
        // Full export options
        includeTabular: z.string().optional().default('true'),
        includeAttachments: z.string().optional().default('true'),
        includeGeoJSON: z.string().optional().default('true'),
        includeKML: z.string().optional().default('true'),
        includeGeoPackage: z.string().optional().default('true'),
        includeMetadata: z.string().optional().default('true'),
        updatedAfter: updatedAfterMsSchema,
        updatedBefore: updatedBeforeMsSchema,
      })
      .refine(updatedTimeQueryRefine, {
        message: 'updatedAfter must be less than updatedBefore',
      }),
    params: z.object({
      id: z.string(),
    }),
  }),
  async (req, res: Response<GetExportNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const updatedFilter = parseUpdatedTimeFilterFromQuery(req.query);

    const payload: CreateDownloadGrantInput = {
      projectID: req.params.id,
      format: req.query.format,
      userId: req.user.user_id,
      ...updatedFilter,
    };

    // Handle full export
    if (req.query.format === 'full') {
      // Build full config from query params (defaults to true if not specified)
      payload.fullConfig = {
        includeTabular: req.query.includeTabular === 'true',
        includeAttachments: req.query.includeAttachments === 'true',
        includeGeoJSON: req.query.includeGeoJSON === 'true',
        includeKML: req.query.includeKML === 'true',
        includeGeoPackage: req.query.includeGeoPackage === 'true',
        includeMetadata: req.query.includeMetadata === 'true',
      };
    } else if (
      REQUIRES_VIEW_ID.includes(req.query.format) ||
      req.query.viewID
    ) {
      // Existing viewID handling for CSV
      if (!req.query.viewID) {
        throw new Exceptions.InvalidRequestException(
          `The specified format ${req.query.format} requires a viewID to be included.`
        );
      }

      // Validate the viewID exists
      const uiSpec = await getUiSpecModel(req.params.id);

      if (!uiSpec || !(req.query.viewID in uiSpec.viewsets)) {
        throw new Exceptions.ItemNotFoundException(
          `Form with id ${req.query.viewID} not found in notebook`
        );
      }

      payload.viewID = req.query.viewID;
    }

    if (req.query.format === 'geopackage') {
      await assertGdalAvailable();
    } else if (
      req.query.format === 'full' &&
      req.query.includeGeoPackage === 'true' &&
      (await projectHasSpatialFields(req.params.id))
    ) {
      await assertGdalAvailable();
    }

    if (hasUpdatedTimeFilter(updatedFilter)) {
      const dataDb = await getDataDb(req.params.id);
      await queryRecordIdsByUpdated({
        dataDb,
        ...updatedFilter,
        limit: 1,
      });
    }

    return mintExportDownload({req, res, payload});
  }
);

/**
 * Export record data (old route for CSV/ZIP with ViewID and Format in the param)
 * @deprecated - use the new /export style route above - this is here for backwards compat
 */
notebookExportRouter.get(
  '/:id/records/:viewID.:format',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  exportRateLimit,
  validate({
    params: z.object({
      id: z.string(),
      viewID: z.string(),
      // don't allow geoJSON or full here - must use new route
      // @deprecated
      format: z.enum(['csv', 'zip']),
    }),
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    // get the label for this form for the filename header
    const uiSpec = await getUiSpecModel(req.params.id);

    // check the view ID is valid
    if (!uiSpec || !(req.params.viewID in uiSpec.viewsets)) {
      throw new Exceptions.ItemNotFoundException(
        `Form with id ${req.params.viewID} not found in notebook`
      );
    }

    const payload: CreateDownloadGrantInput = {
      projectID: req.params.id,
      format: req.params.format,
      userId: req.user.user_id,
      viewID: req.params.viewID,
    };

    return mintExportDownload({req, res, payload, redirect: true});
  }
);

// Legacy unpaginated dump of current record versions (export-shaped).
// Accepts the same exclusive updatedAfter / updatedBefore query as /metadata.
notebookExportRouter.get(
  '/:id/records/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({
    params: z.object({id: z.string()}),
    query: UpdatedTimeQuerySchema,
  }),
  // TODO complete type annotations for this method
  async (req, res: Response<{records: any}>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const tokenContents = mockTokenContentsForUser(req.user);
    const {id: projectId} = req.params;
    const updatedFilter = parseUpdatedTimeFilterFromQuery(req.query);
    const uiSpecification = await getCompiledUiSpecModel(req.params.id);
    compileUiSpecConditionals(uiSpecification);
    const dataDb = await getDataDb(projectId);
    const records = await getRecordsWithRegex({
      dataDb,
      filterDeleted: true,
      projectId,
      regex: '.*',
      tokenContents,
      uiSpecification,
      ...updatedFilter,
    });
    if (records) {
      const filenames: string[] = [];
      const viewIdsNeedingFieldTypes = new Set(
        records.filter(r => r.data && r.type).map(r => r.type)
      );

      const fieldTypesByViewId: Partial<
        Record<string, ReturnType<typeof getNotebookFieldTypes>>
      > = {};
      for (const viewID of viewIdsNeedingFieldTypes) {
        try {
          fieldTypesByViewId[viewID] = getNotebookFieldTypes({
            uiSpecification,
            viewID,
          });
        } catch (e) {
          console.error(
            'Failed to get notebook field types for export',
            viewID,
            e
          );
        }
      }
      // Process any file fields to give the file name in the zip download
      for (const record of records) {
        if (record.data) {
          const fields = fieldTypesByViewId[record.type];
          if (fields) {
            try {
              const dataCopy = {...record.data};
              await stripDeletedRelatedRefsFromRecordData({
                fields,
                data: dataCopy,
                dataDb,
                uiSpecification,
              });
              record.data = dataCopy;
            } catch (e) {
              console.error(
                'Failed to strip deleted related record refs for export',
                e
              );
            }
          }
        }
        const exportData = record.data;
        if (!exportData) {
          continue;
        }
        const hrid = record.hrid || record.record_id;
        for (const fieldName in exportData) {
          const values = exportData[fieldName];
          if (values instanceof Array) {
            const names = values.map((v: any) => {
              if (v instanceof File) {
                let viewID = record.type;
                try {
                  const viewsetId = getIdsByFieldName({
                    fieldName,
                    uiSpecification,
                  }).viewSetId;
                  viewID = viewsetId;
                } catch (e) {
                  console.error(
                    'missing viewset for field',
                    fieldName,
                    'falling back to type'
                  );
                }
                const filename = generateFilenameForAttachment({
                  file: v,
                  fieldId: fieldName,
                  hrid,
                  // The view ID is the viewset ID - which is the 'type'
                  viewID,
                  filenames,
                });
                filenames.push(filename);
                return filename;
              } else {
                return v;
              }
            });
            if (names.length > 0) {
              exportData[fieldName] = names;
            }
          }
        }
      }
      res.json({records});
    } else {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
  }
);

/**
 * Download route — redeem a single-use grant and stream the export.
 *
 * Authenticators (either is enough; Bearer wins if both are sent):
 * - Authorization: Bearer (headless / API — same access token as /export)
 * - HttpOnly download cookie (Control Centre window.open)
 *
 * The grant id in the URL is not a capability. Live disabled +
 * EXPORT_PROJECT_DATA checks run before consume.
 */
notebookExportRouter.get(
  '/download/:grantId',
  exportRateLimit,
  validate({params: z.object({grantId: z.string().min(1).max(128)})}),
  async (req, res) => {
    const grantId = req.params.grantId;
    // Legacy JWT download URLs were three base64url segments joined by `.`.
    if (grantId.includes('.')) {
      return denyDownload(req, 'jwt_url', {grantId});
    }

    const loadedGrant = await getDownloadGrant(grantId);
    if (
      !loadedGrant ||
      loadedGrant.used ||
      loadedGrant.expiryTimestampMs < Date.now()
    ) {
      return denyDownload(
        req,
        !loadedGrant ? 'invalid' : loadedGrant.used ? 'used' : 'expired',
        {grantId}
      );
    }
    const grant = loadedGrant;

    const bearer = extractBearerToken(req);
    const cookie = readDownloadGrantCookie(req);
    let auth: 'bearer' | 'cookie';

    // Bearer wins when both authenticators are present (headless / API).
    if (bearer) {
      const tokenUser = await validateToken(bearer);
      if (!tokenUser) {
        return denyDownload(req, 'invalid_bearer', {
          grantId,
          auth: 'bearer',
        });
      }
      if (tokenUser.user_id !== grant.userId) {
        return denyDownload(req, 'wrong_user', {
          grantId,
          auth: 'bearer',
          userId: tokenUser.user_id,
          projectID: grant.projectID,
          format: grant.format,
          status: 'forbidden',
        });
      }
      auth = 'bearer';
    } else if (cookie) {
      if (
        cookie.grantId !== grantId ||
        !verifyDownloadGrantCookieSecret(grant, cookie.secret)
      ) {
        return denyDownload(req, 'invalid_cookie', {
          grantId,
          auth: 'cookie',
        });
      }
      auth = 'cookie';
    } else {
      return denyDownload(req, 'unauthenticated', {grantId});
    }

    // Live disabled + EXPORT_PROJECT_DATA checks run before consume.
    const dbUser = await getCouchUserFromEmailOrUserId(grant.userId);
    if (!dbUser || isPeopleUserAccountDisabled(dbUser)) {
      return denyDownload(req, !dbUser ? 'user_missing' : 'user_disabled', {
        grantId,
        auth,
        userId: grant.userId,
        projectID: grant.projectID,
        format: grant.format,
      });
    }

    const expressUser = await upgradeCouchUserToExpressUser({dbUser});
    if (
      !userCanDo({
        user: expressUser,
        action: Action.EXPORT_PROJECT_DATA,
        resourceId: grant.projectID,
      })
    ) {
      return denyDownload(req, 'permission_revoked', {
        grantId,
        auth,
        userId: grant.userId,
        projectID: grant.projectID,
        format: grant.format,
        status: 'forbidden',
      });
    }

    const consumed = await consumeDownloadGrant({
      grantId,
      cookieSecret: auth === 'cookie' ? cookie?.secret : undefined,
    });
    if (!consumed.ok) {
      return denyDownload(req, consumed.reason, {
        grantId,
        auth,
        userId: grant.userId,
        projectID: grant.projectID,
        format: grant.format,
      });
    }

    clearDownloadGrantCookie({res, secure: isRequestHttps(req)});
    logDownloadAudit({
      event: 'download.consume',
      outcome: 'success',
      grantId,
      auth,
      userId: grant.userId,
      projectID: grant.projectID,
      format: grant.format,
      impersonatingUserId: grant.impersonatingUserId,
      ...inviteAuditFromRequest(req),
    });

    let exportLabel = '';
    if (REQUIRES_VIEW_ID.includes(grant.format) || grant.viewID) {
      const uiSpec = await getUiSpecModel(grant.projectID);
      if (!grant.viewID) {
        throw new Exceptions.InvalidRequestException(
          'Must provide viewID for this export format.'
        );
      }

      if (!(uiSpec && grant.viewID in uiSpec.viewsets)) {
        throw new Exceptions.ItemNotFoundException(
          `Form with id ${grant.viewID} not found in notebook`
        );
      }
      // Form labels are user-controlled; never interpolate them raw into headers.
      exportLabel = sanitizeDownloadFilename(
        uiSpec.viewsets[grant.viewID].label ?? grant.viewID,
        sanitizeDownloadFilename(grant.viewID, 'export')
      );
    } else {
      exportLabel = sanitizeDownloadFilename(grant.projectID);
    }

    const exportFilter: UpdatedTimeFilter = {
      ...(grant.updatedAfter !== undefined
        ? {updatedAfter: grant.updatedAfter}
        : {}),
      ...(grant.updatedBefore !== undefined
        ? {updatedBefore: grant.updatedBefore}
        : {}),
    };

    setDownloadNoStoreHeaders(res);

    // Depending on the format type - handle differently
    if (grant.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(`${exportLabel}-export.csv`)
      );
      streamNotebookRecordsAsCSV(
        grant.projectID,
        grant.viewID!,
        res,
        exportFilter
      );
    } else if (grant.format === 'zip') {
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(`${exportLabel}-photos.zip`)
      );
      res.setHeader('Content-Type', 'application/zip');
      streamNotebookFilesAsZip({
        projectId: grant.projectID,
        targetViewID: grant.viewID,
        res,
        exportFilter,
      });
    } else if (grant.format === 'geojson') {
      res.setHeader('Content-Type', 'application/geo+json');
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(`${exportLabel}-export.geojson`)
      );
      streamNotebookRecordsAsGeoJSON(grant.projectID, res, exportFilter);
    } else if (grant.format === 'kml') {
      res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(`${exportLabel}-export.kml`)
      );
      streamNotebookRecordsAsKML(grant.projectID, res, exportFilter);
    } else if (grant.format === 'geopackage') {
      // Layers grouped by form + geometry type; built via temp GeoJSON + ogr2ogr.
      await assertGdalAvailable();
      res.setHeader('Content-Type', 'application/geopackage+sqlite3');
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(`${exportLabel}-export.gpkg`)
      );
      await streamNotebookRecordsAsGeoPackage(
        grant.projectID,
        res,
        exportFilter
      );
    } else if (grant.format === 'full') {
      const fullFilename = generateFullExportFilename(grant.projectID);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        contentDispositionAttachment(fullFilename)
      );
      await streamFullExport({
        projectId: grant.projectID,
        userId: grant.userId,
        config: grant.fullConfig,
        res,
        exportFilter,
      });
    } else {
      throw new Exceptions.InvalidRequestException(
        `Unknown export format: ${grant.format}`
      );
    }
  }
);
