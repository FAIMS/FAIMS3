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
  getRecordListAudit,
  getRecordsWithRegex,
  PostAddNotebookUserInputSchema,
  PostCreateNotebookInput,
  PostCreateNotebookInputSchema,
  PostCreateNotebookResponse,
  PostRandomRecordsInputSchema,
  PostRandomRecordsResponse,
  PostRecordStatusInputSchema,
  PostRecordStatusResponse,
  projectRoleToAction,
  ProjectUIModel,
  PutChangeNotebookStatusInputSchema,
  PutChangeNotebookTeamInputSchema,
  PutUpdateNotebookInputSchema,
  PutUpdateNotebookResponse,
  removeProjectRole,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {jwtVerify, SignJWT} from 'jose';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {DEVELOPER_MODE, KEY_SERVICE} from '../buildconfig';
import {getDataDb} from '../couchdb';
import {createManyRandomRecords} from '../couchdb/devtools';
import {
  changeNotebookStatus,
  changeNotebookTeam,
  countRecordsInNotebook,
  createNotebook,
  deleteNotebook,
  generateFilenameForAttachment,
  getEncodedNotebookUISpec,
  getNotebookMetadata,
  getProjectById,
  getProjectUIModel,
  getRolesForNotebook,
  getUserProjectsDetailed,
  streamNotebookFilesAsZip,
  streamNotebookRecordsAsCSV,
  updateNotebook,
} from '../couchdb/notebooks';
import {getTemplate} from '../couchdb/templates';
import {
  getCouchUserFromEmailOrUserId,
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
  processRequest({params: z.object({id: z.string()})}),
  async (req, res: Response<GetNotebookResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    // get full details of a single notebook
    const projectId = req.params.id;

    const project = await getProjectById(projectId);
    const metadata = await getNotebookMetadata(projectId);
    const uiSpec = await getEncodedNotebookUISpec(projectId);

    if (metadata && uiSpec) {
      res.json({
        // include name
        name: project.name,
        metadata,
        // TODO fully implement a UI Spec zod model, and do runtime validation
        // in all client apps
        'ui-specification': uiSpec as unknown as Record<string, unknown>,
        ownedByTeamId: project.ownedByTeamId,
        status: project.status,
        recordCount: await countRecordsInNotebook(projectId),
      } satisfies GetNotebookResponse);
    } else {
      throw new Exceptions.ItemNotFoundException(
        'Notebook not found. ' +
          JSON.stringify({
            'ui-specification': uiSpec as unknown as Record<string, unknown>,
            ownedByTeamId: project.ownedByTeamId,
            status: project.status,
            metadata,
          })
      );
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
    return res.json({notebook: projectID});
  }
);

// PUT change project status
api.put(
  '/:projectId/status',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CHANGE_PROJECT_STATUS,
    getResourceId(req) {
      return req.params.projectId;
    },
  }),
  processRequest({
    params: z.object({projectId: z.string()}),
    body: PutChangeNotebookStatusInputSchema,
  }),
  async ({body: {status}, params: {projectId}}, res) => {
    await changeNotebookStatus({projectId, status});
    res.sendStatus(200);
    return;
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
  processRequest({
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
  processRequest({
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

// Types for download format and token payloads
const DownloadFormatSchema = z.enum(['csv', 'zip']);
const DownloadTokenPayloadSchema = z.object({
  projectID: z.string(),
  format: DownloadFormatSchema,
  viewID: z.string(),
  userID: z.string(),
});
type DownloadTokenPayload = z.infer<typeof DownloadTokenPayloadSchema>;

// download tokens last this long
const DOWNLOAD_TOKEN_EXPIRY_MINUTES = 5;

const generateDownloadToken = async ({
  user,
  payload,
}: {
  user: Express.User;
  payload: DownloadTokenPayload;
}) => {
  const signingKey = await KEY_SERVICE.getSigningKey();
  const token = await new SignJWT(payload)
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
    })
    .setSubject(user.user_id)
    .setIssuedAt()
    .setIssuer(signingKey.instanceName)
    // Expiry in minutes
    .setExpirationTime(DOWNLOAD_TOKEN_EXPIRY_MINUTES.toString() + 'm')
    .sign(signingKey.privateKey);
  return token;
};

const validateDownloadToken = async ({
  token,
}: {
  token: string;
}): Promise<DownloadTokenPayload | null> => {
  const signingKey = await KEY_SERVICE.getSigningKey();
  try {
    const result = await jwtVerify(token, signingKey.publicKey, {
      algorithms: [signingKey.alg],
      // verify issuer
      issuer: signingKey.instanceName,
    });
    return DownloadTokenPayloadSchema.parse(result.payload);
  } catch {
    console.log('invalid token');
    return null;
  }
};

// Export record data.
//
// Export route redirects to a new URL containing a signed JWT containing
// details of the download, that route is handled below to do the actual
// download.
api.get(
  '/:id/records/:viewID.:format',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EXPORT_PROJECT_DATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({
      id: z.string(),
      viewID: z.string(),
      format: DownloadFormatSchema,
    }),
  }),
  async (req, res) => {
    if (req.user) {
      // get the label for this form for the filename header
      const uiSpec = await getEncodedNotebookUISpec(req.params.id);
      if (uiSpec && req.params.viewID in uiSpec.viewsets) {
        const payload: DownloadTokenPayload = {
          projectID: req.params.id,
          format: req.params.format,
          viewID: req.params.viewID,
          userID: req.user.user_id,
        };
        const jwt = await generateDownloadToken({
          user: req.user,
          payload: payload,
        });
        return res.redirect(`/api/notebooks/download/${jwt}`);
      } else {
        throw new Exceptions.ItemNotFoundException(
          `Form with id ${req.params.viewID} not found in notebook`
        );
      }
    }
  }
);

api.get(
  '/download/:downloadToken',
  processRequest({params: z.object({downloadToken: z.string()})}),
  async (req, res) => {
    const payload = await validateDownloadToken({
      token: req.params.downloadToken,
    });
    if (payload) {
      const uiSpec = await getEncodedNotebookUISpec(payload.projectID);
      if (uiSpec && payload.viewID in uiSpec.viewsets) {
        const label = uiSpec.viewsets[payload.viewID].label;
        switch (payload.format) {
          case 'csv':
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${label}.csv"`
            );
            streamNotebookRecordsAsCSV(payload.projectID, payload.viewID, res);
            break;
          case 'zip':
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${label}.zip"`
            );
            res.setHeader('Content-Type', 'application/zip');
            streamNotebookFilesAsZip(payload.projectID, payload.viewID, res);
        }
      } else {
        throw new Exceptions.ItemNotFoundException(
          `Form with id ${payload.viewID} not found in notebook`
        );
      }
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
