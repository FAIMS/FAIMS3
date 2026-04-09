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
  Action,
  addTemplateRole,
  GetListTemplatesResponse,
  GetTemplateByIdResponse,
  GetTemplateSurveyReferencesResponse,
  PostCreateTemplateInput,
  PostCreateTemplateInputSchema,
  PostCreateTemplateResponse,
  PostRestoreTemplateResponse,
  PutUpdateTemplateInputSchema,
  PutUpdateTemplateResponse,
  Role,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {getProjectIdsReferencingTemplate} from '../couchdb/notebooks';
import {
  archiveTemplate,
  createTemplate,
  deleteExistingTemplate,
  getTemplate,
  getTemplates,
  restoreTemplateFromArchive,
  updateExistingTemplate,
} from '../couchdb/templates';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';

import {saveExpressUser} from '../couchdb/users';
import patch from '../utils/patchExpressAsync';

// This must occur before express api is used
patch();

export const api: express.Router = express.Router();

/**
 * GET list templates Gets a list of templates from the templates DB.
 *
 * Can filter by team if desired -  uses an efficient index to do so.
 *
 */
api.get(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({action: Action.LIST_TEMPLATES}),
  processRequest({
    query: z.object({
      teamId: z.string().min(1).optional(),
      // Query strings only: omit (default) or includeArchived=true|false
      includeArchived: z.enum(['true', 'false']).optional(),
    }),
  }),
  async (req, res: Response<GetListTemplatesResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException();
    }

    const templatesRaw = await getTemplates({
      teamId: req.query.teamId,
    });
    const includeArchived = req.query.includeArchived === 'true';

    const filteredByArchive = templatesRaw.filter(t => {
      const archived = t.archived === true;
      return includeArchived ? archived : !archived;
    });

    res.json({
      templates: filteredByArchive.filter(t =>
        userCanDo({
          action: Action.READ_TEMPLATE_DETAILS,
          user: req.user!,
          resourceId: t._id,
        })
      ),
    });
  }
);

/**
 * GET template by id
 * Gets a specific template by ID from the templates DB.
 */
api.get(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_TEMPLATE_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<GetTemplateByIdResponse>) => {
    const template = await getTemplate(req.params.id);
    res.json(template);
  }
);

/**
 * GET count of surveys (projects) that still reference this template id.
 */
api.get(
  '/:id/survey-references',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_TEMPLATE_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<GetTemplateSurveyReferencesResponse>) => {
    const ids = await getProjectIdsReferencingTemplate(req.params.id);
    res.json({surveyCount: ids.length});
  }
);

/**
 * POST create new template
 *
 * Creates a new template. The payload is validated by Zod before reaching this
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
 * PUT update existing template Updates an existing template. The payload is
 * validated by Zod before reaching this function. Expects a document as the
 * response JSON. Requires {@link Action.UPDATE_TEMPLATE_DETAILS} on the template.
 *
 * TODO distinguish between the different types of template updates permission
 * wise. Right now we look for just the update content action.
 */
api.put(
  '/:id',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    // TODO be more specific about the kind of update (i.e. ui spec or not)
    action: Action.UPDATE_TEMPLATE_DETAILS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
    body: PutUpdateTemplateInputSchema,
  }),
  async (req, res: Response<PutUpdateTemplateResponse>) => {
    // pull out template Id
    const templateId = req.params.id;

    // And respond with fulfilled document after updating
    const updatedTemplate = await updateExistingTemplate(templateId, req.body);
    res.json(updatedTemplate);
  }
);

/**
 * POST restore archived template (clears top-level archived flag).
 */
api.post(
  '/:id/restore',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CHANGE_TEMPLATE_STATUS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<PostRestoreTemplateResponse>) => {
    const updated = await restoreTemplateFromArchive(req.params.id);
    res.json(updated);
  }
);

/**
 * POST delete existing template
 * Deletes latest revision of an existing template. Requires
 * {@link Action.DELETE_TEMPLATE} on the template; the template must already
 * be archived.
 */
api.post(
  '/:id/delete',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_TEMPLATE,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
  }),
  async (req, res: Response<PutUpdateTemplateResponse>) => {
    // pull out template Id
    const templateId = req.params.id;

    // Now delete the existing document
    await deleteExistingTemplate(templateId);

    // Indicate successful deletion and send
    res.sendStatus(200);
  }
);

// Archive a template
api.put(
  '/:id/archive',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CHANGE_TEMPLATE_STATUS,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  processRequest({
    params: z.object({id: z.string()}),
    body: z.object({archive: z.boolean()}),
  }),
  async (
    {params: {id}, body: {archive}},
    res: Response<PutUpdateTemplateResponse>
  ) => {
    await archiveTemplate(id, archive);
    res.sendStatus(200);
  }
);
