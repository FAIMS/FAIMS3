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
  EncodedProjectUIModel,
  GetNotebookListResponse,
  GetNotebookResponse,
  GetNotebookUsersResponse,
  PostAddNotebookUserInputSchema,
  PostCreateNotebookInput,
  PostCreateNotebookInputSchema,
  PostCreateNotebookResponse,
  PostRandomRecordsInputSchema,
  PostRandomRecordsResponse,
  PutUpdateNotebookInputSchema,
  PutUpdateNotebookResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
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
  async (req, res: Response<GetNotebookListResponse>) => {
    // get a list of notebooks from the db
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const notebooks = await getNotebooks(req.user);
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
  processRequest({
    body: PostCreateNotebookInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res: Response<PostCreateNotebookResponse>) => {
    // First check the user has permissions to do this action
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to create a notebook.'
      );
    }

    // User is not authorised to create a notebook
    if (!userCanCreateNotebooks(req.user)) {
      throw new Exceptions.UnauthorizedException(
        'You are not authorised to create a notebook.'
      );
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
  }
);

api.get(
  '/:id',
  processRequest({params: z.object({id: z.string()})}),
  requireAuthenticationAPI,
  async (req, res: Response<GetNotebookResponse>) => {
    // get full details of a single notebook
    const project_id = req.params.id;
    if (!req.user || !userHasPermission(req.user, project_id, 'read')) {
      throw new Exceptions.UnauthorizedException();
    }
    const metadata = await getNotebookMetadata(project_id);
    const uiSpec = await getNotebookUISpec(project_id);
    if (metadata && uiSpec) {
      res.json({metadata, 'ui-specification': uiSpec});
    } else {
      throw new Exceptions.ItemNotFoundException('Notebook not found.');
    }
  }
);

// PUT a new version of a notebook
api.put(
  '/:id',
  requireAuthenticationAPI,
  processRequest({
    params: z.object({id: z.string()}),
    body: PutUpdateNotebookInputSchema,
  }),
  async (req, res: Response<PutUpdateNotebookResponse>) => {
    // user must have modify permissions on this notebook
    if (!userHasPermission(req.user, req.params.id, 'modify')) {
      throw new Exceptions.UnauthorizedException(
        'You do not have permission to modify this notebook'
      );
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
  processRequest({
    params: z.object({id: z.string()}),
  }),
  requireAuthenticationAPI,
  // TODO complete type annotations for this method
  async (req, res: Response<{records: any}>) => {
    if (!req.user || !userHasPermission(req.user, req.params.id, 'read')) {
      throw new Exceptions.UnauthorizedException();
    }
    const records = await getNotebookRecords(req.params.id);
    if (records) {
      res.json({records});
    } else {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
  }
);

// export current versions of all records in this notebook as csv
api.get(
  '/:id/:viewID.csv',
  processRequest({params: z.object({id: z.string(), viewID: z.string()})}),
  requireAuthenticationAPI,
  // TODO complete type annotations for this method
  async (req, res) => {
    if (!req.user || !userHasPermission(req.user, req.params.id, 'read')) {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
    res.setHeader('Content-Type', 'text/csv');
    streamNotebookRecordsAsCSV(req.params.id, req.params.viewID, res);
  }
);

// export files for all records in this notebook as zip
api.get(
  '/:id/:viewID.zip',
  processRequest({params: z.object({id: z.string(), viewID: z.string()})}),
  requireAuthenticationAPI,
  // TODO complete type annotations for this method
  async (req, res) => {
    if (!req.user || !userHasPermission(req.user, req.params.id, 'read')) {
      throw new Exceptions.ItemNotFoundException('Notebook not found');
    }
    res.setHeader('Content-Type', 'application/zip');
    streamNotebookFilesAsZip(req.params.id, req.params.viewID, res);
  }
);

api.get(
  '/:id/users/',
  processRequest({params: z.object({id: z.string()})}),
  requireAuthenticationAPI,
  async (req, res: Response<GetNotebookUsersResponse>) => {
    // user must have modify access to this notebook
    if (!userHasPermission(req.user, req.params.id, 'modify')) {
      throw new Exceptions.UnauthorizedException(
        'You do not have permission to view users for this notebook.'
      );
    }
    const userInfo = await getUserInfoForNotebook(req.params.id);
    res.json(userInfo);
  }
);

// POST to give a user permissions on this notebook
api.post(
  '/:id/users/',
  processRequest({
    body: PostAddNotebookUserInputSchema,
    params: z.object({id: z.string()}),
  }),
  requireAuthenticationAPI,
  async (req, res) => {
    if (!userHasPermission(req.user, req.params.id, 'modify')) {
      throw new Exceptions.UnauthorizedException(
        "User does not have permission to modify this project's permissions."
      );
    }

    // Get the notebook metadata to modify
    const notebookMetadata = await getNotebookMetadata(req.params.id);

    if (!notebookMetadata) {
      throw new Exceptions.ItemNotFoundException(
        'Could not find specified notebook.'
      );
    }

    // Destructure request body
    const {username, role, addrole} = req.body;

    // check that this is a legitimate role for this notebook - pass in the
    // metadata to avoid refetching it
    const notebookRoles = await getRolesForNotebook(
      notebookMetadata.project_id,
      notebookMetadata
    );

    // Check for invalid role
    if (!notebookRoles.includes(role)) {
      // The role isn't valid for the notebook
      throw new Exceptions.InvalidRequestException(
        "You cannot add a role which doesn't exist within the notebooks configured roles."
      );
    }

    // Get the user specified
    const user = await getUserFromEmailOrUsername(username);

    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'The username provided cannot be found in the user database.'
      );
    }

    if (addrole) {
      // Add project role to the user
      addProjectRoleToUser(user, notebookMetadata.project_id, role);
    } else {
      // Remove project role from the user
      removeProjectRoleFromUser(user, notebookMetadata.project_id, role);
    }

    // save the user after modifications have been made
    await saveUser(user);
    res.status(200).end();
  }
);

/** Deletes a given notebook by ID */
api.post(
  '/:notebook_id/delete',
  processRequest({params: z.object({notebook_id: z.string()})}),
  requireAuthenticationAPI,
  async (req, res) => {
    if (!userIsClusterAdmin(req.user)) {
      // Not authorised
      throw new Exceptions.UnauthorizedException(
        'Not authorised to delete a notebook.'
      );
    }

    // Delete the notebook
    await deleteNotebook(req.params.notebook_id);

    // 200 OK indicating successful deletion
    res.status(200).end();
  }
);

if (DEVELOPER_MODE) {
  api.post(
    '/:notebook_id/generate',
    requireAuthenticationAPI,
    processRequest({
      body: PostRandomRecordsInputSchema,
      params: z.object({notebook_id: z.string()}),
    }),
    async (req, res: Response<PostRandomRecordsResponse>) => {
      if (!userIsClusterAdmin(req.user)) {
        // Not authorised
        throw new Exceptions.UnauthorizedException(
          'Not authorised to generate random records.'
        );
      }

      const record_ids = await createManyRandomRecords(
        req.params.notebook_id,
        req.body.count
      );
      res.json({record_ids});
    }
  );
}
