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
 *   This module contains the template CRUD API routes
 */

import {
    GetListTemplatesResponse,
    GetTemplateByIdResponse,
    PostCreateTemplateInputSchema,
    PostCreateTemplateResponse,
} from '@faims3/data-model';
import express from 'express';
import { validateRequest } from 'zod-express-middleware';
import { createTemplate, getTemplate, getTemplates } from '../couchdb/notebooks';
import { userCanDoWithTemplate } from '../couchdb/users';
import { requireAuthenticationAPI } from '../middleware';

export const api = express.Router();

/**
 * Gets a list of templates from the templates DB.
 */
api.get<{}, GetListTemplatesResponse>(
  '/templates',
  requireAuthenticationAPI,
  async (_, res) => {
    const templates = await getTemplates();
    res.json({templates: templates});
  }
);

/**
 * Gets a specific template by ID from the templates DB.
 */
api.get<{id: string}, GetTemplateByIdResponse>(
  '/templates/:id',
  requireAuthenticationAPI,
  async (req, res) => {
    const id = req.params.id;
    res.json(await getTemplate(id));
  }
);

/**
 * Creates a new template. The payload is validated by Zod before reaching this
 * function. Expects a document as the response JSON. Requires cluster admin
 * privileges.
 */
api.post<{}, PostCreateTemplateResponse>(
  '/templates',
  validateRequest({
    body: PostCreateTemplateInputSchema,
  }),
  requireAuthenticationAPI,
  async (req, res) => {
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
    return await createTemplate(req.body);
  }
);
