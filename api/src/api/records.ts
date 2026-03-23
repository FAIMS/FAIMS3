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
  DatabaseInterface,
  DataDocument,
  DataEngine,
  DeleteRecordQuerySchema,
  DocumentNotFoundError,
  GetListRecordsQuerySchema,
  GetListRecordsResponse,
  GetRecordQuerySchema,
  GetRecordResponse,
  MalformedParentsError,
  newFormRecordSchema,
  NoHeadsError,
  PatchUpdateRecordInputSchema,
  PatchUpdateRecordResponse,
  PostCreateRecordInputSchema,
  PostCreateRecordResponse,
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
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import {canDeleteRecord, canEditRecord, canReadRecord} from '../recordAuth';

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
    body: PostCreateRecordInputSchema,
  }),
  async (req, res: Response<PostCreateRecordResponse>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const createdBy = req.body.createdBy ?? req.user.user_id;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const validated = newFormRecordSchema.parse({
        formId: req.body.formId,
        createdBy,
        relationship: req.body.relationship,
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
    query: GetListRecordsQuerySchema,
  }),
  async (req, res: Response<GetListRecordsResponse>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const filterDeleted = req.query.filterDeleted === 'false' ? false : true;
    const {formId, limit, startKey} = req.query;
    const rawLimit =
      limit !== undefined && limit !== '' ? parseInt(limit, 10) : NaN;
    const limitNum =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(500, rawLimit)
        : undefined;

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
        limit: limitNum,
        startKey,
        formId,
      });

      const records = result.records.map(r => ({
        ...r,
        // convert dates to ISO strings
        created: r.created.toISOString(),
        updated: r.updated.toISOString(),
      }));
      res.json({
        records,
        ...(result.nextStartKey !== undefined
          ? {nextStartKey: result.nextStartKey}
          : {}),
      });
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
    query: GetRecordQuerySchema,
  }),
  async (req, res: Response<GetRecordResponse>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;
    const revisionId = req.query.revisionId;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (
        !canReadRecord({
          user: req.user,
          projectId,
          createdBy: record.created_by,
        })
      ) {
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
    body: PatchUpdateRecordInputSchema,
  }),
  async (req, res: Response<PatchUpdateRecordResponse>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (
        !canEditRecord({
          user: req.user,
          projectId,
          createdBy: record.created_by,
        })
      ) {
        throw new Exceptions.ForbiddenException(
          'You do not have permission to edit this record.'
        );
      }

      const updated = await engine.form.updateRevision({
        recordId,
        revisionId: req.body.revisionId,
        update: req.body.update,
        mode: req.body.mode ?? 'parent',
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
    query: DeleteRecordQuerySchema,
  }),
  async (req, res: Response<void>) => {
    if (!req.user) throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const {recordId} = req.params;
    const {revisionId} = req.query;

    try {
      const dataDb = await getDataDb(projectId);
      const uiSpec = await getProjectUIModel(projectId);
      const engine = new DataEngine({
        dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      const record = await engine.core.getRecord(recordId);
      if (
        !canDeleteRecord({
          user: req.user,
          projectId,
          createdBy: record.created_by,
        })
      ) {
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
