/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: routes.ts
 * Description:
 *   This module contains notebook related API routes at /api/notebooks
 */

import {
  Action,
  addProjectRole,
  compileUiSpecConditionals,
  CreateNotebookFromScratch,
  CreateNotebookFromTemplate,
  ExportFormat,
  ExportFormatSchema,
  GetExportNotebookResponse,
  getIdsByFieldName,
  getNotebookFieldTypes,
  GetNotebookListResponse,
  GetNotebookResponse,
  GetNotebookUsersResponse,
  getRecordListAudit,
  getRecordsWithRegex,
  hasUpdatedTimeFilter,
  isPeopleUserAccountDisabled,
  queryRecordIdsByUpdated,
  UpdatedTimeFilter,
  updatedAfterMsSchema,
  updatedBeforeMsSchema,
  updatedTimeQueryRefine,
  PostAddNotebookUserInputSchema,
  PostCreateNotebookInput,
  PostCreateNotebookInputSchema,
  PostCreateNotebookResponse,
  PostDestroyNotebookInputSchema,
  PostRandomRecordsInputSchema,
  PostRandomRecordsResponse,
  PostRecordStatusInputSchema,
  PostRecordStatusResponse,
  projectRoleToAction,
  ProjectStatus,
  PutChangeNotebookStatusInputSchema,
  PutChangeNotebookTeamInputSchema,
  PutUpdateNotebookMetadataInputSchema,
  PutUpdateNotebookOfflineMapRegionInputSchema,
  PutUpdateNotebookResponse,
  PutUpdateNotebookUiSpecificationInputSchema,
  removeProjectRole,
  Role,
  userCanReadTemplateDocument,
  userHasProjectRole,
} from '@faims3/data-model';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import {upgradeCouchUserToExpressUser} from '../auth/keySigning/create';
import {validateToken} from '../auth/keySigning/read';
import validate from '../middleware/validate';
import {config} from '../buildconfig';
import {getDataDb} from '../couchdb';
import {
  consumeDownloadGrant,
  CreateDownloadGrantInput,
  createDownloadGrant,
  getDownloadGrant,
  verifyDownloadGrantCookieSecret,
} from '../couchdb/downloadGrants';
import {
  clearDownloadGrantCookie,
  isRequestHttps,
  readDownloadGrantCookie,
  setDownloadGrantCookie,
  setDownloadNoStoreHeaders,
} from '../downloadCookie';
import {exportRateLimit} from '../exportRateLimiter';
import {inviteAuditFromRequest, logDownloadAudit} from '../logging';
import {createManyRandomRecords} from '../couchdb/devtools';
import {
  generateFilenameForAttachment,
  streamNotebookFilesAsZip,
} from '../couchdb/export/attachmentExport';
import {streamNotebookRecordsAsCSV} from '../couchdb/export/csvExport';
import {
  generateFullExportFilename,
  streamFullExport,
} from '../couchdb/export/fullExport';
import {assertGdalAvailable} from '../couchdb/export/gdal';
import {
  projectHasSpatialFields,
  streamNotebookRecordsAsGeoJSON,
  streamNotebookRecordsAsGeoPackage,
  streamNotebookRecordsAsKML,
} from '../couchdb/export/geospatialExport';
import {stripDeletedRelatedRefsFromRecordData} from '../couchdb/export/stripDeletedRelatedRefs';
import {
  contentDispositionAttachment,
  sanitizeDownloadFilename,
} from '../couchdb/export/utils';
import {deleteAllInvitesForProject} from '../couchdb/invites';
import {
  applyNotebookLifecycleStatus,
  changeNotebookTeam,
  countRecordsInNotebook,
  createNotebook,
  deleteNotebook,
  getByteCount,
  getCompiledUiSpecModel,
  getProjectById,
  getRolesForNotebook,
  getUiSpecModel,
  getUserProjectsDetailed,
  updateProjectMetadata,
  updateProjectOfflineMapRegion,
  updateProjectUiSpecification,
} from '../couchdb/notebooks';
import {createNotebookFromTemplate, getTemplate} from '../couchdb/templates';
import {createTombstoneDocument} from '../couchdb/tombstones';
import {
  filterPeopleUsersForList,
  getCouchUserFromEmailOrUserId,
  getUserInfoForProject,
  getUsers,
  saveCouchUser,
  saveExpressUser,
  stripProjectRolesForProjectId,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {
  extractBearerToken,
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import {mockTokenContentsForUser} from '../utils';
import patch from '../utils/patchExpressAsync';
import {recordsRouter} from './records';
import {parseUpdatedTimeFilterFromQuery} from './updatedTimeQuery';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

function permissionRequiredForNotebookStatusChange(
  current: ProjectStatus,
  target: ProjectStatus
): Action {
  if (target === ProjectStatus.OPEN && current === ProjectStatus.ARCHIVED) {
    throw new Exceptions.InvalidRequestException(
      'Cannot open an archived survey. Restore it from the archive first.'
    );
  }

  if (current === target) {
    return current === ProjectStatus.ARCHIVED
      ? Action.CHANGE_PROJECT_ARCHIVE_STATUS
      : Action.CHANGE_PROJECT_STATUS;
  }

  if (target === ProjectStatus.ARCHIVED) {
    return Action.CHANGE_PROJECT_ARCHIVE_STATUS;
  }

  if (current === ProjectStatus.ARCHIVED && target === ProjectStatus.CLOSED) {
    return Action.CHANGE_PROJECT_ARCHIVE_STATUS;
  }

  return Action.CHANGE_PROJECT_STATUS;
}

// =============================================================================
// Types for download format and grant mint (must be before records router)
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
api.get(
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
api.get(
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

// Stateless CRUD API for record data (mount so :id = projectId)
api.use('/:id/records', recordsRouter);

/**
 * Gets a list of notebooks
 */
api.get(
  '/',
  requireAuthenticationAPI,
  validate({
    query: z.object({
      teamId: z.string().min(1).optional(),
      /** When `"true"`, lists archived surveys (`ARCHIVED`). Default excludes them. */
      includeArchived: z.enum(['true', 'false']).optional(),
    }),
  }),
  async (req, res: Response<GetNotebookListResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const includeArchived = req.query.includeArchived === 'true';
    const notebooks = await getUserProjectsDetailed(
      req.user,
      req.query.teamId,
      includeArchived
    );
    res.json(notebooks);
  }
);

/**
 * POST to /notebooks/ to create a new notebook.
 *
 * This route accepts either a from scratch or from template payload. The
 * inclusion of a template_id indicates from a template, and the inclusion of a
 * ui-specification and metadata indicates from scratch. Both payloads are
 * validated in a type safe way.
 */
api.post(
  '/',
  requireAuthenticationAPI,
  validate({
    body: PostCreateNotebookInputSchema,
  }),
  isAllowedToMiddleware({
    getAction(req) {
      const body = req.body as PostCreateNotebookInput;
      // If in team - suitable action (which is against team ID)
      if (body.teamId) {
        return Action.CREATE_PROJECT_IN_TEAM;
      } else {
        // Otherwise global create project required
        return Action.CREATE_PROJECT;
      }
    },
    getResourceId(req) {
      const body = req.body as PostCreateNotebookInput;
      if (body.teamId) {
        // If creating a project in a team, the resource ID is the team!
        return body.teamId;
      } else {
        // If creating a project globally - there is no resource ID!
        return undefined;
      }
    },
  }),
  async (req, res: Response<PostCreateNotebookResponse>) => {
    // Force a check to be sure
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    if ('uiSpecification' in req.body && 'template_id' in req.body) {
      throw new Exceptions.ValidationException(
        'Inappropriate inclusion of both a template_id and uiSpecification when creating a notebook.'
      );
    }

    const isFromScratch = (
      payload: PostCreateNotebookInput
    ): payload is CreateNotebookFromScratch => {
      return 'uiSpecification' in payload;
    };
    const isFromTemplate = (
      payload: PostCreateNotebookInput
    ): payload is CreateNotebookFromTemplate => {
      return 'template_id' in payload;
    };

    let projectID: string | undefined;
    const projectName: string = req.body.name;
    const description =
      'description' in req.body ? req.body.description : undefined;

    if (isFromTemplate(req.body)) {
      const template = await getTemplate(req.body.template_id);

      if (
        !userCanReadTemplateDocument({
          decodedToken: {
            globalRoles: req.user.globalRoles,
            resourceRoles: req.user.resourceRoles,
          },
          template,
        })
      ) {
        throw new Exceptions.UnauthorizedException(
          'You are not authorized to use this template.'
        );
      }

      projectID = await createNotebookFromTemplate({
        template,
        projectName,
        description,
        teamId: req.body.teamId,
        createdBy: req.user.user_id,
        planConfig: req.body.planConfig,
      });
    } else if (isFromScratch(req.body)) {
      projectID = await createNotebook({
        projectName,
        uiSpecification: req.body.uiSpecification,
        description,
        teamId: req.body.teamId,
        createdBy: req.user.user_id,
      });
    } else {
      throw new Exceptions.ValidationException(
        'Could not parse input payload as either a from scratch or from template creation. Contact a system administrator and validate payload integrity.'
      );
    }

    if (projectID) {
      // Make the user an admin of this notebook
      addProjectRole({
        user: req.user,
        projectId: projectID,
        role: Role.PROJECT_ADMIN,
      });
      await saveExpressUser(req.user);
      res.json({notebook: projectID} satisfies PostCreateNotebookResponse);
    } else {
      throw new Exceptions.InternalSystemError(
        'Error occurred during notebook creation.'
      );
    }
  }
);

// Get a specific notebook by ID
api.get(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_PROJECT_METADATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({params: z.object({id: z.string()})}),
  async (req, res: Response<GetNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    // get full details of a single notebook
    const projectId = req.params.id;

    const project = await getProjectById(projectId);

    if (!project.uiSpecification) {
      throw new Exceptions.ItemNotFoundException(
        'Notebook uiSpecification not found. This survey may need migration to projects DB v4.'
      );
    }

    res.json({
      ...project,
      recordCount: await countRecordsInNotebook(projectId),
      byteCount: await getByteCount(projectId),
    } satisfies GetNotebookResponse);
  }
);

// PUT merge inconsequential project metadata (name, description)
api.put(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.UPDATE_PROJECT_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({
    params: z.object({id: z.string()}),
    body: PutUpdateNotebookMetadataInputSchema,
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const updated = await updateProjectMetadata(req.params.id, req.body);
    return res.json(updated);
  }
);

// PUT replace full uiSpecification (designer / JSON export)
api.put(
  '/:id/uiSpecification',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.UPDATE_PROJECT_UISPEC,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({
    params: z.object({id: z.string()}),
    body: PutUpdateNotebookUiSpecificationInputSchema,
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const updated = await updateProjectUiSpecification(req.params.id, req.body);
    return res.json(updated);
  }
);

// PUT set or clear recommended offline map download region
api.put(
  '/:id/offlineMapRegion',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.SET_OFFLINE_MAP_REGION,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({
    params: z.object({id: z.string()}),
    body: PutUpdateNotebookOfflineMapRegionInputSchema,
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const updated = await updateProjectOfflineMapRegion(
      req.params.id,
      req.body
    );
    return res.json(updated);
  }
);

// PUT set notebook lifecycle status (open / closed / archived)
api.put(
  '/:id/status',
  requireAuthenticationAPI,
  validate({
    params: z.object({id: z.string()}),
    body: PutChangeNotebookStatusInputSchema,
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const {id} = req.params;
    const {status: targetStatus} = req.body;
    const project = await getProjectById(id);
    const requiredAction = permissionRequiredForNotebookStatusChange(
      project.status,
      targetStatus
    );

    if (
      !userCanDo({
        user: req.user,
        action: requiredAction,
        resourceId: id,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to perform this action.'
      );
    }

    await applyNotebookLifecycleStatus(project, targetStatus);
    res.sendStatus(200);
  }
);

// PUT change project team
api.put(
  '/:projectId/team',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CHANGE_PROJECT_TEAM,
    getResourceId(req) {
      return req.params.projectId;
    },
  }),
  validate({
    params: z.object({projectId: z.string()}),
    body: PutChangeNotebookTeamInputSchema,
  }),
  async ({body: {teamId}, params: {projectId}}, res) => {
    await changeNotebookTeam({projectId, teamId});
    res.sendStatus(200);
    return;
  }
);

// POST to check sync status of a set of records
api.post(
  '/:id/sync-status/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.AUDIT_ALL_PROJECT_RECORDS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({
    params: z.object({id: z.string()}),
    body: PostRecordStatusInputSchema,
  }),
  async (req, res: Response<PostRecordStatusResponse>) => {
    const {id: projectId} = req.params;
    const {record_map} = req.body;

    const dataDb = await getDataDb(projectId);

    // compute hashes from our database for these records
    const recordIds = Object.getOwnPropertyNames(record_map);
    const localHashes = await getRecordListAudit({
      recordIds,
      dataDb,
    });
    // compare these hashes with the payload
    const result: Record<string, boolean> = {};
    for (const recordId of recordIds) {
      const localHash = localHashes[recordId];
      result[recordId] = record_map[recordId] === localHash;
    }

    res.json({
      status: result,
    });
  }
);

// Legacy unpaginated dump of current record versions (export-shaped).
// Accepts the same exclusive updatedAfter / updatedBefore query as /metadata.
api.get(
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
api.get(
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

api.get(
  '/:id/users/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_PROJECT_USERS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  validate({params: z.object({id: z.string()})}),
  async (req, res: Response<GetNotebookUsersResponse>) => {
    const users = filterPeopleUsersForList(await getUsers(), false);
    const allRoles = getRolesForNotebook().map(r => r.role);
    res.json({
      roles: allRoles,
      users: users
        .map(u => {
          return {
            name: u.name,
            username: u.user_id,
            roles: allRoles.map(r => ({
              value: userHasProjectRole({
                user: u,
                projectId: req.params.id,
                role: r,
              }),
              name: r,
            })),
          };
        })
        .filter(d => d.roles.filter(r => r.value).length > 0),
    });
  }
);

// POST to give a user permissions on this notebook
api.post(
  '/:id/users/',
  requireAuthenticationAPI,
  validate({
    body: PostAddNotebookUserInputSchema,
    params: z.object({id: z.string()}),
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Destructure request body
    const {username, role, addrole: addRole} = req.body;

    // Work out what action this is (specifically protected given role elevation
    // risks)
    const actionNeeded = projectRoleToAction({
      add: addRole,
      role,
    });

    if (
      !userCanDo({
        action: actionNeeded,
        user: req.user,
        resourceId: req.params.id,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to perform this role change.'
      );
    }

    // Get the user specified
    const user = await getCouchUserFromEmailOrUserId(username);

    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'The username provided cannot be found in the user database.'
      );
    }

    if (addRole && isPeopleUserAccountDisabled(user)) {
      throw new Exceptions.ForbiddenException(
        'Cannot assign project roles to a disabled user account.'
      );
    }

    await getProjectById(req.params.id);

    if (addRole) {
      addProjectRole({
        user,
        projectId: req.params.id,
        role: role,
      });
    } else {
      removeProjectRole({user, projectId: req.params.id, role});
    }

    // save the user after modifications have been made
    await saveCouchUser(user);
    res.status(200).end();
  }
);

/**
 * Permanently destroys survey server data (invites, people roles, Couch DBs).
 * Requires archive first. Allowed for survey administrators (or operations staff).
 */
api.post(
  '/:notebookId/delete',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_PROJECT,
    getResourceId(req) {
      return req.params.notebookId;
    },
  }),
  validate({
    params: z.object({notebookId: z.string()}),
    body: PostDestroyNotebookInputSchema,
  }),
  async (req, res) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const {notebookId} = req.params;
    const {confirmName} = req.body;
    const project = await getProjectById(notebookId);
    if (project.name.trim() !== confirmName.trim()) {
      throw new Exceptions.InvalidRequestException(
        'Confirmation name must match the survey name exactly.'
      );
    }
    // Record a tombstone before destroying data so deletion leaves an audit trail
    await createTombstoneDocument(notebookId, {
      name: project.name,
      deletedAt: Date.now(),
      deletedBy: req.user.user_id,
      ownedByTeamId: project.ownedByTeamId,
      dataDbName: project.dataDb?.db_name,
    });
    await deleteAllInvitesForProject(notebookId);
    await stripProjectRolesForProjectId(notebookId);
    await deleteNotebook(notebookId);
    res.status(200).end();
  }
);

if (config.developerMode) {
  api.post(
    '/:notebookId/generate',
    requireAuthenticationAPI,
    isAllowedToMiddleware({
      action: Action.GENERATE_RANDOM_PROJECT_RECORDS,
      getResourceId(req) {
        return req.params.notebookId;
      },
    }),
    validate({
      body: PostRandomRecordsInputSchema,
      params: z.object({notebookId: z.string()}),
    }),
    async (req, res: Response<PostRandomRecordsResponse>) => {
      const record_ids = await createManyRandomRecords(
        req.params.notebookId,
        req.body.count,
        {
          includeAttachments: req.body.includeAttachments,
          parallelism: req.body.parallelism,
        }
      );
      res.json({record_ids});
    }
  );
}

// DELETE a user from a notebook
api.delete(
  '/:notebook_id/users/:user_id',
  requireAuthenticationAPI,
  validate({
    params: z.object({notebook_id: z.string(), user_id: z.string()}),
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Must be authenticated.');
    }

    // Check what resource role the user has on this notebook
    const userInfo = await getUserInfoForProject({
      projectId: req.params.notebook_id,
    });
    const userHasRoles =
      userInfo.users.find(u => u.username === req.params.user_id)?.roles ?? [];

    // Need all actions from these roles
    const requiredActions = userHasRoles.map(role =>
      projectRoleToAction({add: false, role: role.name})
    );
    for (const required of requiredActions) {
      if (
        !userCanDo({
          action: required,
          user: req.user,
          resourceId: req.params.notebook_id,
        })
      ) {
        throw new Exceptions.UnauthorizedException(
          'You are not authorised to remove the user from this notebook.'
        );
      }
    }

    const user = await getCouchUserFromEmailOrUserId(req.params.user_id);

    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'The username provided cannot be found in the user database.'
      );
    }

    // Remove all resource roles associated with this user
    for (const role of user.projectRoles) {
      if (role.resourceId === req.params.notebook_id) {
        removeProjectRole({
          projectId: req.params.notebook_id,
          role: role.role,
          user,
        });
      }
    }

    await saveCouchUser(user);
    res.status(200).end();
  }
);
