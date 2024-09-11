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
  PostCreateTemplateInput,
  PostCreateTemplateInputSchema,
  PostCreateTemplateResponse,
  PostUpdateTemplateInputSchema,
  PostUpdateTemplateResponse,
} from '@faims3/data-model';
import express from 'express';
import {validateRequest} from 'zod-express-middleware';
import {
  createTemplate,
  deleteExistingTemplate,
  getTemplate,
  getTemplates,
  updateExistingTemplate,
} from '../couchdb/templates';
import {userCanDoWithTemplate} from '../couchdb/users';
import {requireAuthenticationAPI} from '../middleware';

export const api = express.Router();

/**
 * GET list templates
 * Gets a list of templates from the templates DB.
 */
api.get<{}, GetListTemplatesResponse>(
  '/',
  requireAuthenticationAPI,
  async (req, res, next) => {
    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to read the list of templates
    if (!userCanDoWithTemplate(req.user, undefined, 'list')) {
      res.status(401).end();
      return;
    }

    try {
      res.json({templates: await getTemplates()});
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET template by id
 * Gets a specific template by ID from the templates DB.
 */
api.get<{id: string}, GetTemplateByIdResponse>(
  '/:id',
  requireAuthenticationAPI,
  async (req, res, next) => {
    const id = req.params.id;

    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, id, 'read')) {
      res.status(401).end();
      return;
    }

    // Try and get the document and pass through to JSON handler if failed
    try {
      res.json(await getTemplate(id));
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST create new template
 * Creates a new template. The payload is validated by Zod before reaching this
 * function. Expects a document as the response JSON. Requires cluster admin
 * privileges.
 */
api.post<{}, PostCreateTemplateResponse, PostCreateTemplateInput>(
  '/',
  validateRequest({
    body: PostCreateTemplateInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res, next) => {
    // First check the user has permissions to do this action
    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, undefined, 'create')) {
      res.status(401).end();
      return;
    }

    // Now we can create the new template and return it
    try {
      res.json(await createTemplate(req.body));
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PUT update existing template
 * Updates an existing template. The payload is validated by Zod before reaching this
 * function. Expects a document as the response JSON. Requires cluster admin
 * privileges.
 */
api.put<{id: string}, PostUpdateTemplateResponse>(
  '/:id',
  validateRequest({
    body: PostUpdateTemplateInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res, next) => {
    // pull out template Id
    const templateId = req.params.id;

    // First check the user has permissions to do this action
    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, templateId, 'update')) {
      res.status(401).end();
      return;
    }

    // Now update the existing document
    try {
      await updateExistingTemplate(templateId, req.body);
    } catch (e) {
      next(e);
    }

    // And respond with fulfilled document
    res.json({
      _id: templateId,
      ...req.body,
    });
  }
);

/**
 * POST delete existing template
 * Deletes latest revision of an existing template. Requires cluster admin
 * privileges.
 */
api.post<{id: string}, PostUpdateTemplateResponse>(
  '/:id/delete',
  requireAuthenticationAPI,
  async (req, res, next) => {
    // pull out template Id
    const templateId = req.params.id;

    // First check the user has permissions to do this action
    if (!req.user) {
      res.status(401).end();
      return;
    }

    // User is not authorised to create a template
    if (!userCanDoWithTemplate(req.user, templateId, 'delete')) {
      res.status(401).end();
      return;
    }

    // Now delete the existing document
    try {
      await deleteExistingTemplate(templateId);
    } catch (e) {
      next(e);
      return;
    }

    // Indicate successful deletion and send
    res.sendStatus(200);
  }
);
