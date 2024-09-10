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

import express from 'express';
import {getTemplate, getTemplates} from '../couchdb/notebooks';
import {requireAuthenticationAPI} from '../middleware';
import {
  GetListTemplatesResponse,
  GetTemplateByIdResponse,
  PostCreateTemplateInput,
  PostCreateTemplateResponse,
} from '@faims3/data-model';

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
 * Creates a new template.
 * Requires cluster admin privileges.
 * TODO destub
 */
api.post<{id: string}, PostCreateTemplateResponse, PostCreateTemplateInput>(
  '/templates',
  requireAuthenticationAPI,
  async (req, res) => {
    // TODO destub
  }
);
