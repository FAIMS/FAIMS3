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
  CreateNotebookFromScratch,
  CreateNotebookFromTemplate,
  GetNotebookListResponse,
  GetNotebookResponse,
  PostCreateNotebookInput,
  PostCreateNotebookInputSchema,
  PostCreateNotebookResponse,
  ProjectUIModel,
} from '@faims3/data-model';
import express from 'express';
import {processRequest} from 'zod-express-middleware';
import {DEVELOPER_MODE} from '../buildconfig';
import {createManyRandomRecords} from '../couchdb/devtools';
import {
  createNotebook,
  deleteNotebook,
  getNotebookMetadata,
  getNotebookRecords,
  getNotebooks,
  getNotebookUISpec,
  getRolesForNotebook,
  streamNotebookFilesAsZip,
  streamNotebookRecordsAsCSV,
  updateNotebook,
} from '../couchdb/notebooks';
import {getTemplate} from '../couchdb/templates';
import {
  addProjectRoleToUser,
  getUserFromEmailOrUsername,
  getUserInfoForNotebook,
  removeProjectRoleFromUser,
  saveUser,
  userCanCreateNotebooks,
  userHasPermission,
  userIsClusterAdmin,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';

export const api = express.Router();

api.get<{}, GetNotebookListResponse>(
  '/',
  requireAuthenticationAPI,
  async (req, res) => {
    // get a list of notebooks from the db
    if (req.user) {
      const notebooks: GetNotebookListResponse = await getNotebooks(req.user);
      res.json(notebooks);
    } else {
      throw new Exceptions.UnauthorizedException();
    }
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
api.post<{}, PostCreateNotebookResponse, PostCreateNotebookInput>(
  '/',
  processRequest({
    body: PostCreateNotebookInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res, next) => {
    // First check the user has permissions to do this action
    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to create a notebook
    if (!userCanCreateNotebooks(req.user)) {
      res.status(401).end();
      return;
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
    let uiSpec: ProjectUIModel;
    // Project name is in both payloads
    let projectName: string = req.body.name;
    // Template ID is only needed if created from template
    let templateId: string | undefined = undefined;

    // Check the type of creation
    if (isFromTemplate(req.body)) {
      // Now we use the template to get details needed to instantiate a new notebook
      let template;
      try {
        template = await getTemplate(req.body.template_id);
      } catch (e) {
        next(e);
        return;
      }

      // Pull out values needed to create a new notebook
      metadata = template.metadata;
      uiSpec = template.ui_specification;
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

    try {
      const projectID = await createNotebook(
        projectName,
        uiSpec,
        metadata,
        // link to template ID if necessary
        templateId
      );
      if (projectID) {
        // allow this user to modify the new notebook
        addProjectRoleToUser(req.user, projectID, 'admin');
        await saveUser(req.user);
        res.json({notebook: projectID} as PostCreateNotebookResponse);
      } else {
        throw new Exceptions.InternalSystemError(
          'Error occurred during notebook creation.'
        );
      }
    } catch (err) {
      throw new Exceptions.InternalSystemError(
        'Error occurred during notebook creation.'
      );
    }
  }
);

api.get<{id: string}, GetNotebookResponse>(
  '/:id',
  requireAuthenticationAPI,
  async (req, res) => {
    // get full details of a single notebook
    const project_id = req.params.id;
    if (req.user && userHasPermission(req.user, project_id, 'read')) {
      const metadata = await getNotebookMetadata(project_id);
      const uiSpec = await getNotebookUISpec(project_id);
      if (metadata && uiSpec) {
        res.json({metadata, 'ui-specification': uiSpec} as GetNotebookResponse);
      } else {
        throw new Exceptions.ItemNotFoundException('Notebook not found.');
      }
    } else {
      throw new Exceptions.UnauthorizedException();
    }
  }
);

// PUT a new version of a notebook
api.put('/:id', requireAuthenticationAPI, async (req, res) => {
  // user must have modify permissions on this notebook
  if (userHasPermission(req.user, req.params.id, 'modify')) {
    const uiSpec = req.body['ui-specification'];
    const metadata = req.body.metadata;
    const projectID = req.params.id;
    try {
      await updateNotebook(projectID, uiSpec, metadata);
      res.json({notebook: projectID});
    } catch (err) {
      console.log('Error creating notebook', err);
    }
  } else {
    res
      .status(401)
      .json({
        error: 'you do not have permission to modify this notebook',
      })
      .end();
  }
});

// export current versions of all records in this notebook
api.get('/:id/records/', requireAuthenticationAPI, async (req, res) => {
  let records = [];
  if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
    records = await getNotebookRecords(req.params.id);
  }
  if (records) {
    res.json({records});
  } else {
    res.status(404).json({error: 'notebook not found'}).end();
  }
});

// export current versions of all records in this notebook as csv
api.get('/:id/:viewID.csv', requireAuthenticationAPI, async (req, res) => {
  if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
    try {
      res.setHeader('Content-Type', 'text/csv');
      streamNotebookRecordsAsCSV(req.params.id, req.params.viewID, res);
    } catch (err) {
      console.log('Error streaming CSV', err);
      res.status(500).json({error: 'error creating CSV'}).end();
    }
  } else {
    res.status(404).json({error: 'notebook not found'}).end();
  }
});

// export files for all records in this notebook as zip
api.get('/:id/:viewid.zip', requireAuthenticationAPI, async (req, res) => {
  if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
    res.setHeader('Content-Type', 'application/zip');
    streamNotebookFilesAsZip(req.params.id, req.params.viewid, res);
  } else {
    res.status(404).json({error: 'notebook not found'}).end();
  }
});

api.get('/:id/users/', requireAuthenticationAPI, async (req, res) => {
  // user must have admin access tot his notebook

  if (userHasPermission(req.user, req.params.id, 'modify')) {
    const userInfo = await getUserInfoForNotebook(req.params.id);
    res.json(userInfo);
  } else {
    res
      .status(401)
      .json({
        error: 'you do not have permission to view users for this notebook',
      })
      .end();
  }
});

// POST to give a user permissions on this notebook
// body includes:
//   {
//     username: 'a username or email',
//     role: a valid role for this notebook,
//     addrole: boolean, true to add, false to delete
//   }
api.post('/:id/users/', requireAuthenticationAPI, async (req, res) => {
  if (userHasPermission(req.user, req.params.id, 'modify')) {
    let error = '';
    const notebook = await getNotebookMetadata(req.params.id);
    if (notebook) {
      const username = req.body.username;
      const role = req.body.role;
      const addrole = req.body.addrole;

      // check that this is a legitimate role for this notebook
      const notebookRoles = await getRolesForNotebook(notebook.project_id);
      if (notebookRoles.indexOf(role) >= 0) {
        const user = await getUserFromEmailOrUsername(username);
        if (user) {
          if (addrole) {
            await addProjectRoleToUser(user, notebook.project_id, role);
          } else {
            await removeProjectRoleFromUser(user, notebook.project_id, role);
          }
          await saveUser(user);
          res.json({status: 'success'});
          return;
        } else {
          error = 'Unknown user ' + username;
        }
      } else {
        error = 'Unknown role';
      }
    } else {
      error = 'Unknown notebook';
    }
    // user or project not found or bad role
    res.status(404).json({status: 'error', error}).end();
  } else {
    res
      .status(401)
      .json({
        status: 'error',
        error: 'you do not have permission to modify users for this notebook',
      })
      .end();
  }
});

api.post('/:notebook_id/delete', requireAuthenticationAPI, async (req, res) => {
  if (userIsClusterAdmin(req.user)) {
    const project_id = req.params.notebook_id;
    const notebook = await getNotebookMetadata(project_id);
    if (notebook) {
      await deleteNotebook(project_id);
      res.redirect('/notebooks/');
    } else {
      res.status(404).end();
    }
  } else {
    res.status(401).end();
  }
});

if (DEVELOPER_MODE) {
  api.post(
    '/:notebook_id/generate',
    requireAuthenticationAPI,
    async (req, res) => {
      if (userIsClusterAdmin(req.user)) {
        const project_id = req.params.notebook_id;
        const count = req.body.count || 1;
        const record_ids = await createManyRandomRecords(project_id, count);
        res.status(200).json({record_ids});
      } else {
        res.status(401).end();
      }
    }
  );
}
