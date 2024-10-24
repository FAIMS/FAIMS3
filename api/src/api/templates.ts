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
  GetListTemplatesResponse,
  GetTemplateByIdResponse,
  PostCreateTemplateInputSchema,
  PostCreateTemplateResponse,
  PutUpdateTemplateInputSchema,
  PutUpdateTemplateResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  createTemplate,
  deleteExistingTemplate,
  getTemplate,
  getTemplates,
  updateExistingTemplate,
} from '../couchdb/templates';
import {userCanDoWithTemplate} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';

import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api = express.Router();

/**
 * GET list templates
 * Gets a list of templates from the templates DB.
 */
api.get(
  '/',
  requireAuthenticationAPI,
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
  }
);

/**
 * GET template by id
 * Gets a specific template by ID from the templates DB.
 */
api.get(
  '/:id',
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
    }

    // Now we can create the new template and return it
    const newTemplate = await createTemplate(req.body);
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
