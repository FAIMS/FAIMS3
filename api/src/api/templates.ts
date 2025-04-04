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
 * Filename: templates.ts
 * Description:
 *   This module contains the template CRUD API routes at /api/templates
 */

import {
<<<<<<< HEAD
=======
  Action,
  addTemplateRole,
>>>>>>> origin/main
  GetListTemplatesResponse,
  GetTemplateByIdResponse,
  PostCreateTemplateInput,
  PostCreateTemplateInputSchema,
  PostCreateTemplateResponse,
  PutUpdateTemplateInputSchema,
  PutUpdateTemplateResponse,
  Role,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  archiveTemplate,
  createTemplate,
  deleteExistingTemplate,
  getTemplate,
  getTemplates,
  updateExistingTemplate,
} from '../couchdb/templates';
<<<<<<< HEAD
import {userCanDoWithTemplate} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';
=======
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
>>>>>>> origin/main

import {saveExpressUser} from '../couchdb/users';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

/**
 * GET list templates Gets a list of templates from the templates DB.
 *
 * Can filter by team if desired -  uses an efficient index to do so.
 *
 */
api.get(
  '/',
  requireAuthenticationAPI,
<<<<<<< HEAD
  async (req, res: Response<GetListTemplatesResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get templates.'
      );
    }

    // User is not authorised to read the list of templates
    if (!userCanDoWithTemplate(req.user, undefined, 'list')) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get templates.'
      );
    }
    res.json({templates: await getTemplates()});
=======
  isAllowedToMiddleware({action: Action.LIST_TEMPLATES}),
  processRequest({query: z.object({teamId: z.string().min(1).optional()})}),
  async (req, res: Response<GetListTemplatesResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    res.json({
      templates: (await getTemplates({teamId: req.query.teamId})).filter(t =>
        userCanDo({
          action: Action.READ_TEMPLATE_DETAILS,
          user: req.user!,
          resourceId: t._id,
        })
      ),
    });
>>>>>>> origin/main
  }
);

/**
 * GET template by id
 * Gets a specific template by ID from the templates DB.
 */
api.get(
  '/:id',
<<<<<<< HEAD
=======
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_TEMPLATE_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
>>>>>>> origin/main
  processRequest({
    params: z.object({id: z.string()}),
  }),
  requireAuthenticationAPI,
  async (req, res: Response<GetTemplateByIdResponse>) => {
    const id = req.params.id;

    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to get templates.'
      );
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, id, 'read')) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to read this template.'
      );
    }

    const template = await getTemplate(id);
    res.json(template);
  }
);

/**
 * POST create new template
 * Creates a new template. The payload is validated by Zod before reaching this
<<<<<<< HEAD
 * function. Expects a document as the response JSON. Requires cluster admin
 * privileges.
 */
api.post(
  '/',
  processRequest({
    body: PostCreateTemplateInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res: Response<PostCreateTemplateResponse>) => {
    // Parse the input schema to strip keys

    // First check the user has permissions to do this action
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to create templates.'
      );
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, undefined, 'create')) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to create a template.'
      );
=======
 * function. Expects a document as the response JSON.
 *
 * Permissions respect team context.
 */
api.post(
  '/',
  requireAuthenticationAPI,
  processRequest({
    body: PostCreateTemplateInputSchema,
  }),
  isAllowedToMiddleware({
    getAction(req) {
      const body = req.body as PostCreateTemplateInput;
      if (body.teamId) {
        return Action.CREATE_TEMPLATE_IN_TEAM;
      } else {
        return Action.CREATE_TEMPLATE;
      }
    },
    getResourceId(req) {
      const body = req.body as PostCreateTemplateInput;
      if (body.teamId) {
        // If creating a template in a team, the resource ID is the team!
        return body.teamId;
      } else {
        // If creating a template globally - there is no resource ID!
        return undefined;
      }
    },
  }),
  async (req, res: Response<PostCreateTemplateResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
>>>>>>> origin/main
    }

    // Now we can create the new template and return it
    const newTemplate = await createTemplate({
      payload: req.body,
    });

    // Make the creator the admin
    addTemplateRole({
      user: req.user,
      role: Role.TEMPLATE_ADMIN,
      templateId: newTemplate._id,
    });
    await saveExpressUser(req.user);

    res.json(newTemplate);
  }
);

/**
 * PUT update existing template
 * Updates an existing template. The payload is validated by Zod before reaching this
 * function. Expects a document as the response JSON. Requires cluster admin
 * privileges.
 */
api.put(
  '/:id',
<<<<<<< HEAD
=======
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    // TODO be more specific about the kind of update (i.e. ui spec or not)
    action: Action.UPDATE_TEMPLATE_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
>>>>>>> origin/main
  processRequest({
    params: z.object({id: z.string()}),
    body: PutUpdateTemplateInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res: Response<PutUpdateTemplateResponse>) => {
    // pull out template Id
    const templateId = req.params.id;

    // First check the user has permissions to do this action
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to update templates.'
      );
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, templateId, 'update')) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to update this template.'
      );
    }

    // Now update the existing document
    // And respond with fulfilled document after updating
    const updatedTemplate = await updateExistingTemplate(templateId, req.body);
    res.json(updatedTemplate);
  }
);

/**
 * POST delete existing template
 * Deletes latest revision of an existing template. Requires cluster admin
 * privileges.
 */
api.post(
  '/:id/delete',
<<<<<<< HEAD
=======
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_TEMPLATE,
    getResourceId(req) {
      return req.params.id;
    },
  }),
>>>>>>> origin/main
  processRequest({
    params: z.object({id: z.string()}),
  }),
  requireAuthenticationAPI,
  async (req, res: Response<PutUpdateTemplateResponse>) => {
    // pull out template Id
    const templateId = req.params.id;

    // First check the user has permissions to do this action
    if (!req.user) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to delete templates.'
      );
    }

    // User is not authorised to delete a template
    if (!userCanDoWithTemplate(req.user, templateId, 'delete')) {
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to delete this template.'
      );
    }

    // Now delete the existing document
    await deleteExistingTemplate(templateId);

    // Indicate successful deletion and send
    res.sendStatus(200);
  }
);

// Archive a template
api.put(
  '/:id/archive',
<<<<<<< HEAD
=======
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CHANGE_TEMPLATE_STATUS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
>>>>>>> origin/main
  processRequest({
    params: z.object({id: z.string()}),
    body: z.object({archive: z.boolean()}),
  }),
  requireAuthenticationAPI,
  async (
    {
      params: {id},
      user,
      body: {archive},
    }: {params: {id: string}; user?: Express.User; body: {archive: boolean}},
    res: Response<PutUpdateTemplateResponse>
  ) => {
    if (!user || !userCanDoWithTemplate(user, id, 'update'))
      throw new Exceptions.UnauthorizedException(
        'You are not allowed to archive this template.'
      );

    await archiveTemplate(id, archive);
    res.sendStatus(200);
  }
);
