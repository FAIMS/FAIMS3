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
 * See, the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: notebooks.ts
 * Description:
 *   This module contains notebook related API routes at /api/notebooks
 */

import {
  Action,
  addProjectRole,
  CreateNotebookFromScratch,
  CreateNotebookFromTemplate,
  GetNotebookListResponse,
  GetNotebookResponse,
  GetNotebookUsersResponse,
  getRecordListAudit,
  isPeopleUserAccountDisabled,
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
import express, {Response} from 'express';
import {z} from 'zod';
import validate from '../middleware/validate';
import {config} from '../buildconfig';
import {getDataDb} from '../couchdb';
import {createManyRandomRecords} from '../couchdb/devtools';
import {deleteAllInvitesForProject} from '../couchdb/invites';
import {
  applyNotebookLifecycleStatus,
  changeNotebookTeam,
  countRecordsInNotebook,
  createNotebook,
  deleteNotebook,
  getByteCount,
  getProjectById,
  getRolesForNotebook,
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
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import patch from '../utils/patchExpressAsync';
import {notebookExportRouter} from './notebooks/export';
import {recordsRouter} from './records';

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

// Export mint routes (`/:id/records/export`, `/:id/records/:viewID.:format`)
// must be registered before the records CRUD router.
api.use(notebookExportRouter);

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
