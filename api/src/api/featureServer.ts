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
 * ESRI-compatible Feature Service for notebook spatial data.
 * One layer per form/viewset with at least one spatial field.
 */

import {
  Action,
  buildFeatureServiceLayerIndex,
  buildViewsetFieldSummaries,
} from '@faims3/data-model';
import type {FeatureServiceLayerDefinition} from '@faims3/data-model';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  createRecordIterator,
  initSpatialExportContext,
  streamLayerAsGeoJSON,
} from '../couchdb/export/geospatialExport';
import {getProjectUIModel} from '../couchdb/notebooks';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
} from '../middleware';
import {canReadRecord} from '../recordAuth';

function projectIdFromReq(req: {params: {id?: string}}): string {
  const id = req.params.id;
  if (!id) {
    throw new Exceptions.InvalidRequestException('Missing project id');
  }
  return id;
}

const queryParamsSchema = z.object({
  where: z.string().optional(),
  f: z.string().optional(), // validated in handler: only geojson/json supported; pbf returns 400
  outFields: z.string().optional(),
  returnGeometry: z.enum(['true', 'false']).optional(),
  resultOffset: z.coerce.number().min(0).optional(),
  resultRecordCount: z.coerce.number().min(0).optional(),
});

export const featureServerRouter: express.Router = express.Router({
  mergeParams: true,
});

/** Set DISABLE_FEATURE_SERVER_AUTH=true to allow unauthenticated access for testing (e.g. QGIS/ArcGIS without JWT). */
const featureServerAuthDisabled =
  process.env.DISABLE_FEATURE_SERVER_AUTH === 'true';

const readRecordsAuth = featureServerAuthDisabled
  ? []
  : [
      requireAuthenticationAPI,
      isAllowedToMiddleware({
        action: Action.READ_MY_PROJECT_RECORDS,
        getResourceId: req => req.params.id,
      }),
    ];

/**
 * GET /api/notebooks/:id/FeatureServer
 * Service root: returns layers array for ESRI clients.
 */
featureServerRouter.get(
  '/',
  readRecordsAuth,
  processRequest({
    params: z.object({id: z.string().min(1)}),
  }),
  async (req: Request, res: Response) => {
    if (!featureServerAuthDisabled && !req.user)
      throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    try {
      const uiSpec = await getProjectUIModel(projectId);
      const layers: FeatureServiceLayerDefinition[] =
        buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
      res.json({
        currentVersion: 11,
        serviceDescription: 'FAIMS3 Feature Service',
        layers: layers.map((l: FeatureServiceLayerDefinition) => ({
          id: l.layerId,
          name: l.name,
        })),
        spatialReference: {wkid: 4326, latestWkid: 4326},
      });
    } catch (err) {
      throw err;
    }
  }
);

/**
 * GET /api/notebooks/:id/FeatureServer/info
 * Service info: same as service root. ESRI clients (e.g. OpenLayers/Digital Atlas) request this.
 */
featureServerRouter.get(
  '/info',
  readRecordsAuth,
  processRequest({
    params: z.object({id: z.string().min(1)}),
  }),
  async (req: Request, res: Response) => {
    if (!featureServerAuthDisabled && !req.user)
      throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    try {
      const uiSpec = await getProjectUIModel(projectId);
      const layers: FeatureServiceLayerDefinition[] =
        buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
      res.json({
        currentVersion: 11,
        serviceDescription: 'FAIMS3 Feature Service',
        layers: layers.map((l: FeatureServiceLayerDefinition) => ({
          id: l.layerId,
          name: l.name,
        })),
        spatialReference: {wkid: 4326, latestWkid: 4326},
      });
    } catch (err) {
      throw err;
    }
  }
);

/**
 * GET /api/notebooks/:id/FeatureServer/:layerId
 * Layer metadata: geometryType, spatialReference, fields.
 */
featureServerRouter.get(
  '/:layerId',
  readRecordsAuth,
  processRequest({
    params: z.object({id: z.string().min(1), layerId: z.string()}),
  }),
  async (req: Request, res: Response) => {
    if (!featureServerAuthDisabled && !req.user)
      throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const layerIdParam = req.params.layerId;
    const layerId = parseInt(layerIdParam, 10);
    if (Number.isNaN(layerId) || layerId < 0) {
      throw new Exceptions.InvalidRequestException('Invalid layer id');
    }
    try {
      const uiSpec = await getProjectUIModel(projectId);
      const layers: FeatureServiceLayerDefinition[] =
        buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
      const layer = layers.find((l: FeatureServiceLayerDefinition) => l.layerId === layerId);
      if (!layer) {
        throw new Exceptions.ItemNotFoundException('Layer not found');
      }
      const viewFieldsMap = buildViewsetFieldSummaries({
        uiSpecification: uiSpec,
      });
      const fieldSummaries = viewFieldsMap[layer.formId] ?? [];
      const fields = [
        {name: 'record_id', type: 'esriFieldTypeString', alias: 'Record ID'},
        {name: 'revision_id', type: 'esriFieldTypeString', alias: 'Revision ID'},
        {name: 'type', type: 'esriFieldTypeString', alias: 'Form'},
        {name: 'hrid', type: 'esriFieldTypeString', alias: 'HRID'},
        {name: 'geometry_source_field_id', type: 'esriFieldTypeString', alias: 'Geometry source field'},
        ...fieldSummaries.map(f => ({
          name: f.name,
          type: 'esriFieldTypeString' as const,
          alias: f.name,
        })),
      ];
      res.json({
        id: layer.layerId,
        name: layer.name,
        type: 'Feature Layer',
        geometryType: 'esriGeometryPoint',
        spatialReference: {wkid: 4326, latestWkid: 4326},
        fields,
        capabilities: 'Query',
        supportedQueryFormats: 'JSON, geoJSON',
        maxRecordCount: 2000,
        advancedQueryCapabilities: {
          supportsPagination: true,
          supportsQueryWithDistance: false,
          supportsResultType: false,
          useStandardizedQueries: true,
        },
      });
    } catch (err) {
      if (err instanceof Exceptions.ItemNotFoundException) throw err;
      if (err instanceof Exceptions.InvalidRequestException) throw err;
      throw err;
    }
  }
);

/**
 * GET /api/notebooks/:id/FeatureServer/:layerId/query
 * Query layer: returns GeoJSON FeatureCollection (f=geojson).
 */
featureServerRouter.get(
  '/:layerId/query',
  readRecordsAuth,
  processRequest({
    params: z.object({id: z.string().min(1), layerId: z.string()}),
    query: queryParamsSchema.optional(),
  }),
  async (
    req: Request<
      {id: string; layerId: string},
      unknown,
      unknown,
      z.infer<typeof queryParamsSchema> | undefined
    >,
    res: Response
  ) => {
    if (!featureServerAuthDisabled && !req.user)
      throw new Exceptions.UnauthorizedException();
    const projectId = projectIdFromReq(req);
    const layerIdParam = req.params.layerId;
    const layerId = parseInt(layerIdParam, 10);
    if (Number.isNaN(layerId) || layerId < 0) {
      throw new Exceptions.InvalidRequestException('Invalid layer id');
    }
    const q = req.query;
    const format = (q?.f as string | undefined) ?? 'geojson';
    const supportedFormats = ['geojson', 'json'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      res.status(400).json({
        error: {
          code: 400,
          message: `Format '${format}' is not supported. Use f=geojson or f=json (see supportedQueryFormats in layer metadata).`,
          details: ['PBF and tile requests are not supported; use standard query with f=geojson.'],
        },
      });
      return;
    }
    const resultOffset =
      typeof q?.resultOffset === 'number' ? q.resultOffset : Number(q?.resultOffset) || 0;
    const resultRecordCount =
      typeof q?.resultRecordCount === 'number'
        ? q.resultRecordCount
        : q?.resultRecordCount != null
          ? Number(q.resultRecordCount)
          : undefined;

    try {
      const context = await initSpatialExportContext(projectId);
      const uiSpec = context.uiSpecification;
      const layers: FeatureServiceLayerDefinition[] =
        buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
      const layer = layers.find((l: FeatureServiceLayerDefinition) => l.layerId === layerId);
      if (!layer) {
        throw new Exceptions.ItemNotFoundException('Layer not found');
      }

      const layerFormId = layer.formId;
      const iterator = await createRecordIterator(projectId, context);
      const user = req.user;

      async function* filteredHydratedRecords() {
        let next = await iterator.next();
        while (!next.done) {
          const record = next.record;
          next = await iterator.next();
          if (!record || record.type !== layerFormId) continue;
          if (
            !featureServerAuthDisabled &&
            user &&
            !canReadRecord({
              user,
              projectId,
              createdBy: record.created_by,
            })
          ) {
            continue;
          }
          yield record;
        }
      }

      res.setHeader('Content-Type', 'application/geo+json');
      await streamLayerAsGeoJSON(
        context,
        layerFormId,
        filteredHydratedRecords(),
        res,
        {resultOffset, resultRecordCount}
      );
    } catch (err) {
      if (err instanceof Exceptions.ItemNotFoundException) throw err;
      if (err instanceof Exceptions.InvalidRequestException) throw err;
      throw err;
    }
  }
);
