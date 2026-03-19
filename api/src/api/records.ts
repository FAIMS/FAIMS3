/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Stateless CRUD API for record data under /api/notebooks/:id/records
 */

import {
  Action,
  DataDocument,
  DataEngine,
  DatabaseInterface,
  DocumentNotFoundError,
  MalformedParentsError,
  newFormRecordSchema,
  NoHeadsError,
  RecordConflictError,
  RevisionMismatchError,
  setRecordAsDeleted,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {getDataDb} from '../couchdb';
import {getProjectUIModel} from '../couchdb/notebooks';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
} from '../middleware';
import {
  canDeleteRecord,
  canEditRecord,
  canReadRecord,
} from '../recordAuth';

// ---------------------------------------------------------------------------
// Request/response schemas (aligned with data-model types)
// ---------------------------------------------------------------------------

const formAnnotationSchema = z.object({
  annotation: z.string(),
  uncertainty: z.boolean(),
});

const faimsAttachmentSchema = z.object({
  attachmentId: z.string(),
  filename: z.string(),
  fileType: z.string(),
});

const formDataEntrySchema = z.object({
  data: z.unknown(),
  annotation: formAnnotationSchema.optional(),
  attachments: z.array(faimsAttachmentSchema).optional(),
});

const formUpdateDataSchema = z.record(z.string(), formDataEntrySchema);

const formRelationshipInstanceSchema = z.object({
  recordId: z.string(),
  fieldId: z.string(),
  relationTypeVocabPair: z.tuple([z.string(), z.string()]),
});

const formRelationshipSchema = z.object({
  parent: z.array(formRelationshipInstanceSchema).optional(),
  linked: z.array(formRelationshipInstanceSchema).optional(),
});

const createRecordBodySchema = z.object({
  formId: z.string(),
  createdBy: z.string().optional(),
  relationship: formRelationshipSchema.optional(),
});

const updateRecordBodySchema = z.object({
  revisionId: z.string(),
  update: formUpdateDataSchema,
  mode: z.enum(['new', 'parent']).optional(),
});

const deleteRecordQuerySchema = z.object({
  revisionId: z.string(),
});

const listRecordsQuerySchema = z.object({
  formId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  startKey: z.string().optional(),
  filterDeleted: z.enum(['true', 'false']).optional(),
});

const getRecordQuerySchema = z.object({
  revisionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectIdFromReq(req: express.Request): string {
  const id = req.params.id;
  if (!id) {
    throw new Exceptions.InvalidRequestException('Missing project id');
  }
  return id;
}

function mapDataModelError(err: unknown): never {
  if (err instanceof DocumentNotFoundError) {
    throw new Exceptions.ItemNotFoundException(err.message);
  }
  if (err instanceof RecordConflictError) {
    throw new Exceptions.ConflictException(
      `Record conflict: ${err.message}. Specify revisionId to resolve.`
    );
  }
  if (err instanceof NoHeadsError) {
    throw new Exceptions.InvalidRequestException(err.message);
  }
  if (err instanceof RevisionMismatchError) {
    throw new Exceptions.InvalidRequestException(err.message);
  }
  if (err instanceof MalformedParentsError) {
    throw new Exceptions.InvalidRequestException(err.message);
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Router (mount at /:id/records so req.params.id = projectId)
// ---------------------------------------------------------------------------

export const recordsRouter: express.Router = express.Router({
  mergeParams: true,
});

/**
 * POST /api/notebooks/:id/records - Create a new record
 */
recordsRouter.post(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CREATE_PROJECT_RECORD,
    getResourceId: req => req.params.id,
  }),
  processRequest({
    params: z.object({id: z.string().min(1)}),
    body: createRecordBodySchema,
  }),
  async (req, res: Response<{recordId: string; revisionId: string}>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const body = req.body as z.infer<typeof createRecordBodySchema>;
    const createdBy = body.createdBy ?? req.user.user_id;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const validated = newFormRecordSchema.parse({
        formId: body.formId,
        createdBy,
        relationship: body.relationship,
      });
      const {record, revision} = await engine.form.createRecord(validated);
      res.status(201).json({
        recordId: record._id,
        revisionId: revision._id,
      });
    } catch (err) {
      mapDataModelError(err);
    }
  }
);

/**
 * GET /api/notebooks/:id/records - List records (permission-filtered)
 */
recordsRouter.get(
  '/',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_MY_PROJECT_RECORDS,
    getResourceId: req => req.params.id,
  }),
  processRequest({
    params: z.object({id: z.string().min(1)}),
    query: listRecordsQuerySchema.optional(),
  }),
  async (req, res: Response<{records: Array<Record<string, unknown>>}>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const filterDeleted =
      req.query?.filterDeleted === 'false' ? false : true;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const result = await engine.query.listMinimalRecordMetadata({
        projectId,
        filterDeleted,
        filterFunction: rec =>
          canReadRecord({
            user: req.user!,
            projectId,
            createdBy: rec.createdBy,
          }),
      });

      const formId =
        typeof req.query?.formId === 'string' ? req.query.formId : undefined;
      const limit =
        typeof req.query?.limit === 'number' ? req.query.limit : undefined;
      const startKey =
        typeof req.query?.startKey === 'string'
          ? req.query.startKey
          : undefined;
      let list = result.records;
      if (formId) list = list.filter(r => r.type === formId);
      list = [...list].sort((a, b) =>
        a.recordId.localeCompare(b.recordId, 'en')
      );
      if (startKey) list = list.filter(r => r.recordId > startKey);
      if (limit !== undefined) list = list.slice(0, limit);
      const records = list.map(r => ({
        projectId: r.projectId,
        recordId: r.recordId,
        revisionId: r.revisionId,
        created:
          r.created instanceof Date ? r.created.toISOString() : r.created,
        createdBy: r.createdBy,
        updated:
          r.updated instanceof Date ? r.updated.toISOString() : r.updated,
        updatedBy: r.updatedBy,
        conflicts: r.conflicts,
        deleted: r.deleted,
        type: r.type,
        relationship: r.relationship,
      }));
      res.json({records});
    } catch (err) {
      mapDataModelError(err);
    }
  }
);

/**
 * GET /api/notebooks/:id/records/:recordId - Get one record (full form data)
 */
recordsRouter.get(
  '/:recordId',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.READ_MY_PROJECT_RECORDS,
    getResourceId: req => req.params.id,
  }),
  processRequest({
    params: z.object({id: z.string().min(1), recordId: z.string().min(1)}),
    query: getRecordQuerySchema.optional(),
  }),
  async (req, res: Response) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;
    const revisionId =
      typeof req.query?.revisionId === 'string'
        ? req.query.revisionId
        : undefined;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (!canReadRecord({
        user: req.user,
        projectId,
        createdBy: record.created_by,
      })) {
        throw new Exceptions.ForbiddenException(
          'You do not have permission to read this record.'
        );
      }

      const formData = await engine.form.getExistingFormData({
        recordId,
        revisionId,
        config: {conflictBehaviour: 'pickFirst'},
      });

      res.json(formData);
    } catch (err) {
      if (err instanceof Exceptions.ForbiddenException) throw err;
      mapDataModelError(err);
    }
  }
);

/**
 * PATCH /api/notebooks/:id/records/:recordId - Update record (full or partial fields)
 */
recordsRouter.patch(
  '/:recordId',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.EDIT_MY_PROJECT_RECORDS,
    getResourceId: req => req.params.id,
  }),
  processRequest({
    params: z.object({id: z.string().min(1), recordId: z.string().min(1)}),
    body: updateRecordBodySchema,
  }),
  async (req, res: Response<{revisionId: string}>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;
    const body = req.body as z.infer<typeof updateRecordBodySchema>;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (!canEditRecord({
        user: req.user,
        projectId,
        createdBy: record.created_by,
      })) {
        throw new Exceptions.ForbiddenException(
          'You do not have permission to edit this record.'
        );
      }

      const updated = await engine.form.updateRevision({
        recordId,
        revisionId: body.revisionId,
        update: body.update,
        mode: body.mode ?? 'parent',
        updatedBy: req.user.user_id,
      });
      res.json({revisionId: updated._id});
    } catch (err) {
      if (err instanceof Exceptions.ForbiddenException) throw err;
      mapDataModelError(err);
    }
  }
);

/**
 * DELETE /api/notebooks/:id/records/:recordId - Soft-delete record
 */
recordsRouter.delete(
  '/:recordId',
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.DELETE_MY_PROJECT_RECORDS,
    getResourceId: req => req.params.id,
  }),
  processRequest({
    params: z.object({id: z.string().min(1), recordId: z.string().min(1)}),
    query: deleteRecordQuerySchema,
  }),
  async (req, res: Response) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;
    const revisionId = req.query.revisionId as string;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (!canDeleteRecord({
        user: req.user,
        projectId,
        createdBy: record.created_by,
      })) {
        throw new Exceptions.ForbiddenException(
          'You do not have permission to delete this record.'
        );
      }

      await setRecordAsDeleted({
        dataDb,
        recordId,
        baseRevisionId: revisionId,
        userId: req.user.user_id,
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof Exceptions.ForbiddenException) throw err;
      mapDataModelError(err);
    }
  }
);
