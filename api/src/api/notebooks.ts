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
  CreateNotebookFromScratch,
  CreateNotebookFromTemplate,
  EncodedProjectUIModel,
  GetNotebookListResponse,
  GetNotebookResponse,
  GetNotebookUsersResponse,
  getRecordsWithRegex,
  isAuthorized,
  PostAddNotebookUserInputSchema,
  PostCreateNotebookInput,
  PostCreateNotebookInputSchema,
  PostCreateNotebookResponse,
  PostRandomRecordsInputSchema,
  PostRandomRecordsResponse,
  projectInviteToAction,
  projectRoleToAction,
  ProjectUIModel,
  PutUpdateNotebookInputSchema,
  PutUpdateNotebookResponse,
  removeProjectRole,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {DEVELOPER_MODE} from '../buildconfig';
import {getDataDb, localGetProjectsDb} from '../couchdb';
import {createManyRandomRecords} from '../couchdb/devtools';
import {createInvite, getInvitesForNotebook} from '../couchdb/invites';
import {
  createNotebook,
  deleteNotebook,
  generateFilenameForAttachment,
  getEncodedNotebookUISpec,
  getNotebookMetadata,
  getProjectUIModel,
  getRolesForNotebook,
  getUserProjectsDetailed,
  streamNotebookFilesAsZip,
  streamNotebookRecordsAsCSV,
  streamNotebookRecordsAsXLSX,
  updateNotebook,
} from '../couchdb/notebooks';
import {getTemplate} from '../couchdb/templates';
import {
  getCouchUserFromEmailOrUsername,
  getUserInfoForProject,
  getUsers,
  saveCouchUser,
  saveExpressUser,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import {mockTokenContentsForUser} from '../utils';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

/**
 * Gets a list of notebooks
 */
api.get(
  '/',
  requireAuthenticationAPI,
  processRequest({query: z.object({teamId: z.string().min(1).optional()})}),
  async (req, res: Response<GetNotebookListResponse>) => {
    // get a list of notebooks from the db
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const notebooks = await getUserProjectsDetailed(req.user, req.query.teamId);
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
  processRequest({
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
    // Validate payload combination
    if ('ui-specification' in req.body && 'template_id' in req.body) {
      throw new Exceptions.ValidationException(
        'Inappropriate inclusion of both a template_id and a ui-specification when creating a notebook.'
      );
    }

    // Functions which determine which type of payload is present

    // TODO consider using a discriminated union approach for parsing here to
    // make this more efficient e.g. zod allows literals on objects with
    // discriminated unions on this
    const isFromScratch = (
      payload: PostCreateNotebookInput
    ): payload is CreateNotebookFromScratch => {
      return 'ui-specification' in payload;
    };
    const isFromTemplate = (
      payload: PostCreateNotebookInput
    ): payload is CreateNotebookFromTemplate => {
      return 'template_id' in payload;
    };

    // Metadata is from payload, or from template
    let metadata: any;
    // ui Spec is from payload if manual, or from template
    let uiSpec: EncodedProjectUIModel;
    // Project name is in both payloads
    const projectName: string = req.body.name;
    // Template ID is only needed if created from template
    let templateId: string | undefined = undefined;

    // Check the type of creation
    if (isFromTemplate(req.body)) {
      // Now we use the template to get details needed to instantiate a new notebook
      const template = await getTemplate(req.body.template_id);

      // Pull out values needed to create a new notebook
      metadata = template.metadata;
      uiSpec = template['ui-specification'];
      templateId = template._id;
    } else if (isFromScratch(req.body)) {
      // Creating a new notebook from scratch
      uiSpec = req.body['ui-specification'];
      metadata = req.body.metadata;
    } else {
      throw new Exceptions.ValidationException(
        'Could not parse input payload as either a from scratch or from template creation. Contact a system administrator and validate payload integrity.'
      );
    }

    const projectID = await createNotebook(
      projectName,
      uiSpec,
      metadata,
      // link to template ID if necessary
      templateId,
      // team ID if provided (authorisation to do so already checked)
      req.body.teamId
    );
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

api.get(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_PROJECT_METADATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({params: z.object({id: z.string()})}),
  async (req, res: Response<GetNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    // get full details of a single notebook
    const project_id = req.params.id;
    let project;
    try {
      project = await localGetProjectsDb().get(project_id);
    } catch (e) {
      // Could not find the project
      throw new Exceptions.ItemNotFoundException(
        `Failed to find the project with ID ${project_id}.`
      );
    }

    const metadata = await getNotebookMetadata(project_id);
    const uiSpec = await getEncodedNotebookUISpec(project_id);
    if (metadata && uiSpec) {
      res.json({
        metadata,
        // TODO fully implement a UI Spec zod model, and do runtime validation
        // in all client apps
        'ui-specification': uiSpec as unknown as Record<string, unknown>,
        ownedByTeamId: project.ownedByTeamId,
      } satisfies GetNotebookResponse);
    } else {
      throw new Exceptions.ItemNotFoundException('Notebook not found.');
    }
  }
);

// PUT a new version of a notebook
api.put(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.UPDATE_PROJECT_UISPEC,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
    body: PutUpdateNotebookInputSchema,
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const uiSpec = req.body['ui-specification'];
    const metadata = req.body.metadata;
    const projectID = req.params.id;
    await updateNotebook(projectID, uiSpec, metadata);
    res.json({notebook: projectID}).end();
  }
);

// export current versions of all records in this notebook
api.get(
  '/:id/records/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  // TODO complete type annotations for this method
  async (req, res: Response<{records: any}>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const tokenContents = mockTokenContentsForUser(req.user);
    const {id: projectId} = req.params;
    const uiSpecification = (await getProjectUIModel(
      req.params.id
    )) as ProjectUIModel;
    const dataDb = await getDataDb(projectId);
    const records = await getRecordsWithRegex({
      dataDb,
      filterDeleted: true,
      projectId,
      regex: '.*',
      tokenContents,
      uiSpecification,
    });
    if (records) {
      const filenames: string[] = [];
      // Process any file fields to give the file name in the zip download
      records.forEach((record: any) => {
        const hrid = record.hrid || record.record_id;
        for (const fieldName in record.data) {
          const values = record.data[fieldName];
          if (values instanceof Array) {
            const names = values.map((v: any) => {
              if (v instanceof File) {
                const filename = generateFilenameForAttachment(
                  v,
                  fieldName,
                  hrid,
                  filenames
                );
                filenames.push(filename);
                return filename;
              } else {
                return v;
              }
            });
            if (names.length > 0) {
              record.data[fieldName] = names;
            }
          }
        }
      });
      res.json({records});
    } else {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
  }
);

// export current versions of all records in this notebook as csv
api.get(
  '/:id/:viewID.csv',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({params: z.object({id: z.string(), viewID: z.string()})}),
  async (req, res) => {
    // get the label for this form for the filename header
    const uiSpec = await getEncodedNotebookUISpec(req.params.id);
    if (uiSpec && req.params.viewID in uiSpec.viewsets) {
      const label = uiSpec.viewsets[req.params.viewID].label;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${label}.csv"`
      );
      streamNotebookRecordsAsCSV(req.params.id, req.params.viewID, res);
    } else {
      throw new Exceptions.ItemNotFoundException(
        `Form with id ${req.params.viewID} not found in notebook`
      );
    }
  }
);

// export files for all records in this notebook as zip
api.get(
  '/:id/:viewID.zip',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({params: z.object({id: z.string(), viewID: z.string()})}),
  async (req, res) => {
    // get the label for this form for the filename header
    const uiSpec = await getEncodedNotebookUISpec(req.params.id);
    if (uiSpec && req.params.viewID in uiSpec.viewsets) {
      const label = uiSpec.viewsets[req.params.viewID].label;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${label}.zip"`
      );
      res.setHeader('Content-Type', 'application/zip');
      streamNotebookFilesAsZip(req.params.id, req.params.viewID, res);
    } else {
      throw new Exceptions.ItemNotFoundException(
        `Form with id ${req.params.viewID} not found in notebook`
      );
    }
  }
);

// export current versions of all records in this notebook as xlsx
api.get(
  '/:id/:viewID.xlsx',
  processRequest({params: z.object({id: z.string(), viewID: z.string()})}),
  requireAuthenticationAPI,
  async (req, res) => {
    if (!req.user || !userHasPermission(req.user, req.params.id, 'read')) {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
    // get the label for this form for the filename header
    const uiSpec = await getEncodedNotebookUISpec(req.params.id);
    if (uiSpec && req.params.viewID in uiSpec.viewsets) {
      const label = uiSpec.viewsets[req.params.viewID].label;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${label}.xlsx"`
      );
      streamNotebookRecordsAsXLSX(req.params.id, req.params.viewID, res);
    } else {
      throw new Exceptions.ItemNotFoundException(
        `Form with id ${req.params.viewID} not found in notebook`
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
  processRequest({params: z.object({id: z.string()})}),
  async (req, res: Response<GetNotebookUsersResponse>) => {
    const users = await getUsers();
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
  processRequest({
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
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: req.user.globalRoles,
          resourceRoles: req.user.resourceRoles,
        },
        resourceId: req.params.id,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to perform this role change.'
      );
    }

    // Get the user specified
    const user = await getCouchUserFromEmailOrUsername(username);

    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'The username provided cannot be found in the user database.'
      );
    }

    // Get the notebook metadata to modify
    const notebookMetadata = await getNotebookMetadata(req.params.id);

    if (!notebookMetadata) {
      throw new Exceptions.ItemNotFoundException(
        'Could not find specified notebook.'
      );
    }

    if (addRole) {
      // Add project role to the user
      addProjectRole({
        user,
        projectId: req.params.id,
        role: role,
      });
    } else {
      // Remove project role from the user
      removeProjectRole({user, projectId: notebookMetadata.project_id, role});
    }

    // save the user after modifications have been made
    await saveCouchUser(user);
    res.status(200).end();
  }
);

/** Deletes a given notebook by ID */
api.post(
  '/:notebookId/delete',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_PROJECT,
    getResourceId(req) {
      return req.params.notebookId;
    },
  }),
  processRequest({params: z.object({notebookId: z.string()})}),
  async (req, res) => {
    // Delete the notebook
    await deleteNotebook(req.params.notebookId);

    // 200 OK indicating successful deletion
    res.status(200).end();
  }
);

/** Gets a list of invites for a given notebook */
api.get(
  '/:notebookId/invites',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VIEW_PROJECT_INVITES,
    getResourceId(req) {
      return req.params.notebookId;
    },
  }),
  processRequest({params: z.object({notebookId: z.string()})}),
  async ({params: {notebookId}}, res) => {
    const invites = await getInvitesForNotebook(notebookId);
    res.json(invites);
  }
);

/** Creates a new invite for a given notebook */
api.post(
  '/:notebookId/invites',
  requireAuthenticationAPI,
  processRequest({
    body: z.object({role: z.nativeEnum(Role)}),
    params: z.object({notebookId: z.string()}),
  }),
  async ({body: {role}, params: {notebookId}, user}, res) => {
    if (!user) {
      throw new Exceptions.UnauthorizedException();
    }

    // Get the action needed
    const actionNeeded = projectInviteToAction({action: 'create', role});
    if (
      !isAuthorized({
        action: actionNeeded,
        decodedToken: {
          globalRoles: user.globalRoles,
          resourceRoles: user.resourceRoles,
        },
        resourceId: notebookId,
      })
    ) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to create this invite'
      );
    }
    const invite = await createInvite(notebookId, role);
    res.json(invite);
  }
);

if (DEVELOPER_MODE) {
  api.post(
    '/:notebookId/generate',
    requireAuthenticationAPI,
    isAllowedToMiddleware({
      action: Action.GENERATE_RANDOM_PROJECT_RECORDS,
      getResourceId(req) {
        return req.params.notebookId;
      },
    }),
    processRequest({
      body: PostRandomRecordsInputSchema,
      params: z.object({notebookId: z.string()}),
    }),
    async (req, res: Response<PostRandomRecordsResponse>) => {
      const record_ids = await createManyRandomRecords(
        req.params.notebookId,
        req.body.count
      );
      res.json({record_ids});
    }
  );
}

// DELETE a user from a notebook
api.delete(
  '/:notebook_id/users/:user_id',
  requireAuthenticationAPI,
  processRequest({
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

    const user = await getCouchUserFromEmailOrUsername(req.params.user_id);

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
