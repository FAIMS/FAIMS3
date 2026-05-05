/*
 * OGC API — Features (Part 1 Core) prototype for FAIMS survey data.
 *
 * All `/ogc` routes are intentionally public (no authentication) for local GIS
 * testing; add auth before any production exposure.
 */

import {
  HydratedDataRecord,
  RecordRevisionIndexDocument,
  Revision,
  hydrateRecord,
} from '@faims3/data-model';
import express, {NextFunction, Request, Response} from 'express';
import {OGC_BASE_URL} from '../buildconfig';
import {getDataDb} from '../couchdb';
import {
  collectNotebookGeoJsonFeaturesForOgc,
  collectOgcGeoJsonFeaturesForHydratedRecord,
  OgcGeoJsonFeature,
} from '../couchdb/export/geospatialExport';
import {
  getAllProjectsDirectory,
  getNotebookMetadata,
  getProjectUIModel,
} from '../couchdb/notebooks';

const AUSTRALIA_BBOX: [[number, number, number, number]] = [
  [112, -44, 154, -10],
];

const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';

/** OpenAPI 3.0 media type (OGC Part 1 / GDAL / CITE). */
const OGC_OPENAPI_MEDIA_TYPE =
  'application/vnd.oai.openapi+json;version=3.0';

export const ogcRouter: express.Router = express.Router();

type Bbox = {minLon: number; minLat: number; maxLon: number; maxLat: number};

function ogcUrl(path: string): string {
  const base = OGC_BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function setOgcJsonHeaders(res: Response): void {
  res.set('Content-Type', 'application/json');
  res.set('Access-Control-Allow-Origin', '*');
}

function setOgcGeoJsonHeaders(res: Response): void {
  res.set('Content-Type', 'application/geo+json');
  res.set('Access-Control-Allow-Origin', '*');
}

function setOpenApiHeaders(res: Response): void {
  res.set('Content-Type', OGC_OPENAPI_MEDIA_TYPE);
  res.set('Access-Control-Allow-Origin', '*');
}

/**
 * Minimal OpenAPI 3.0 document for req/core (service-desc) and GDAL/QGIS clients.
 * Paths are relative to {@link OGC_BASE_URL} (no trailing slash).
 */
function buildOpenApiDocument(): Record<string, unknown> {
  const serverUrl = OGC_BASE_URL.replace(/\/$/, '');
  const json200 = {
    description: 'JSON response',
    content: {
      'application/json': {
        schema: {type: 'object'},
      },
    },
  };
  const geojson200 = {
    description: 'GeoJSON response',
    content: {
      'application/geo+json': {
        schema: {type: 'object'},
      },
    },
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'FAIMS Survey Data',
      version: '0.1.0',
      description:
        'OGC API Features prototype for FAIMS field survey data (OpenAPI for conformance and clients).',
    },
    servers: [{url: serverUrl}],
    paths: {
      '/collections': {
        get: {
          summary: 'List collections',
          operationId: 'getCollections',
          responses: {'200': json200},
        },
      },
      '/collections/{collectionId}': {
        get: {
          summary: 'Describe a collection',
          operationId: 'describeCollection',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
          ],
          responses: {'200': json200},
        },
      },
      '/collections/{collectionId}/items': {
        get: {
          summary: 'List features',
          operationId: 'getFeatures',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
            {name: 'limit', in: 'query', schema: {type: 'integer'}},
            {name: 'offset', in: 'query', schema: {type: 'integer'}},
            {name: 'bbox', in: 'query', schema: {type: 'string'}},
          ],
          responses: {'200': geojson200},
        },
      },
      '/collections/{collectionId}/items/{featureId}': {
        get: {
          summary: 'Get a feature',
          operationId: 'getFeature',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
            {
              name: 'featureId',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
          ],
          responses: {'200': geojson200},
        },
      },
      '/conformance': {
        get: {
          summary: 'Conformance declaration',
          operationId: 'getConformance',
          responses: {'200': json200},
        },
      },
    },
  };
}

function notFound(res: Response, description: string): void {
  setOgcJsonHeaders(res);
  res.status(404).json({code: 'NotFound', description});
}

function invalidParameter(res: Response, description: string): void {
  setOgcJsonHeaders(res);
  res.status(400).json({code: 'InvalidParameter', description});
}

function parseBboxParam(raw: unknown): Bbox | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const s = String(raw);
  const parts = s.split(',').map(p => Number.parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    return undefined;
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon > maxLon || minLat > maxLat) {
    return undefined;
  }
  return {minLon, minLat, maxLon, maxLat};
}

function extendCoords(coords: unknown, acc: Bbox): void {
  if (!Array.isArray(coords) || coords.length === 0) {
    return;
  }
  if (typeof coords[0] === 'number') {
    const lon = coords[0] as number;
    const lat = coords[1] as number;
    acc.minLon = Math.min(acc.minLon, lon);
    acc.maxLon = Math.max(acc.maxLon, lon);
    acc.minLat = Math.min(acc.minLat, lat);
    acc.maxLat = Math.max(acc.maxLat, lat);
    return;
  }
  for (const c of coords) {
    extendCoords(c, acc);
  }
}

function geometryExtent(geometry: {
  type?: string;
  coordinates?: unknown;
}): Bbox | null {
  if (!geometry?.coordinates) {
    return null;
  }
  const acc: Bbox = {
    minLon: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  };
  extendCoords(geometry.coordinates, acc);
  if (!Number.isFinite(acc.minLon)) {
    return null;
  }
  return acc;
}

function bboxIntersects(a: Bbox, b: Bbox): boolean {
  return !(
    a.maxLon < b.minLon ||
    a.minLon > b.maxLon ||
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat
  );
}

function featureIntersectsBbox(
  feature: OgcGeoJsonFeature,
  bbox: Bbox
): boolean {
  const ext = geometryExtent(feature.geometry);
  if (!ext) {
    return false;
  }
  return bboxIntersects(ext, bbox);
}

function parseLimitOffset(
  req: Request
): {limit: number; offset: number} | null {
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const limit =
    limitRaw === undefined || limitRaw === ''
      ? 100
      : Number.parseInt(String(limitRaw), 10);
  const offset =
    offsetRaw === undefined || offsetRaw === ''
      ? 0
      : Number.parseInt(String(offsetRaw), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return null;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return null;
  }
  return {limit, offset};
}

function itemsQueryString(parts: {
  limit: number;
  offset: number;
  bbox?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set('limit', String(parts.limit));
  sp.set('offset', String(parts.offset));
  if (parts.bbox !== undefined) {
    sp.set('bbox', parts.bbox);
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

async function hydrateRecordById(
  projectId: string,
  recordId: string
): Promise<HydratedDataRecord | null> {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const res = await dataDb.query('index/recordRevisions', {
    keys: [recordId],
    include_docs: true,
  });
  const row = res.rows[0];
  if (!row?.doc || row.id === undefined) {
    return null;
  }
  const revision = row.doc as Revision;
  if (revision.deleted) {
    return null;
  }
  const value = row.value as
    | {
        _id: string;
        conflict: boolean;
        created: number;
        created_by: string;
        type: string;
      }
    | undefined;
  if (!value?._id) {
    return null;
  }
  const recordStub: RecordRevisionIndexDocument = {
    record_id: row.id,
    revision_id: value._id,
    created: value.created,
    created_by: value.created_by,
    conflict: value.conflict,
    type: value.type,
    revision,
  };
  return hydrateRecord({
    projectId,
    dataDb,
    record: recordStub,
    uiSpecification,
    includeAttachments: false,
  });
}

function collectionDescriptor(opts: {
  projectId: string;
  title: string;
  description: string;
}): {
  id: string;
  title: string;
  description: string;
  extent: {
    spatial: {bbox: [[number, number, number, number]]; crs: string};
  };
  links: Array<{href: string; rel: string; type: string; title: string}>;
} {
  const {projectId, title, description} = opts;
  return {
    id: projectId,
    title,
    description,
    extent: {
      spatial: {
        bbox: AUSTRALIA_BBOX,
        crs: CRS84,
      },
    },
    links: [
      {
        href: ogcUrl(`/collections/${encodeURIComponent(projectId)}/items`),
        rel: 'items',
        type: 'application/geo+json',
        title,
      },
    ],
  };
}

ogcRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

ogcRouter.get('/', (_req: Request, res: Response) => {
  setOgcJsonHeaders(res);
  res.json({
    title: 'FAIMS Survey Data',
    description: 'OGC API Features endpoint for FAIMS field survey data',
    links: [
      {
        href: ogcUrl('/'),
        rel: 'self',
        type: 'application/json',
        title: 'This document',
      },
      {
        href: ogcUrl('/api'),
        rel: 'service-desc',
        type: OGC_OPENAPI_MEDIA_TYPE,
        title: 'OpenAPI 3.0 definition',
      },
      {
        href: ogcUrl('/conformance'),
        rel: 'conformance',
        type: 'application/json',
        title: 'Conformance declaration',
      },
      {
        href: ogcUrl('/collections'),
        rel: 'data',
        type: 'application/json',
        title: 'Collections',
      },
    ],
  });
});

ogcRouter.get('/conformance', (_req: Request, res: Response) => {
  setOgcJsonHeaders(res);
  res.json({
    conformsTo: [
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core',
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/oas30',
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson',
    ],
  });
});

const openApiHandler = (_req: Request, res: Response) => {
  setOpenApiHeaders(res);
  res.json(buildOpenApiDocument());
};

ogcRouter.get('/api', openApiHandler);
ogcRouter.get('/api/', openApiHandler);

ogcRouter.get(
  '/collections',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO(production): replace with an ACL-filtered listing; this exposes every
      // project document in CouchDB while `/ogc` is intentionally unauthenticated.
      const projects = await getAllProjectsDirectory();
      const collections = await Promise.all(
        projects.map(async p => {
          const meta = await getNotebookMetadata(p._id);
          const description =
            meta && typeof meta.description === 'string'
              ? meta.description
              : '';
          return collectionDescriptor({
            projectId: p._id,
            title: p.name,
            description,
          });
        })
      );
      setOgcJsonHeaders(res);
      res.json({
        collections,
        links: [
          {
            href: ogcUrl('/collections'),
            rel: 'self',
            type: 'application/json',
          },
        ],
      });
    } catch (e) {
      next(e);
    }
  }
);

ogcRouter.get(
  '/collections/:notebookId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {notebookId} = req.params;
      const metadata = await getNotebookMetadata(notebookId);
      if (!metadata) {
        notFound(res, `Notebook not found: ${notebookId}`);
        return;
      }
      const title =
        typeof metadata.name === 'string' ? metadata.name : notebookId;
      const description =
        typeof metadata.description === 'string' ? metadata.description : '';
      setOgcJsonHeaders(res);
      res.json(
        collectionDescriptor({
          projectId: notebookId,
          title,
          description,
        })
      );
    } catch (e) {
      next(e);
    }
  }
);

ogcRouter.get(
  '/collections/:notebookId/items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {notebookId} = req.params;
      const lo = parseLimitOffset(req);
      if (!lo) {
        invalidParameter(
          res,
          'Invalid limit or offset: limit must be 1–1000 and offset a non-negative integer.'
        );
        return;
      }
      const {limit, offset} = lo;
      const bboxFilter = parseBboxParam(req.query.bbox);
      if (req.query.bbox !== undefined && String(req.query.bbox) !== '') {
        if (!bboxFilter) {
          invalidParameter(
            res,
            'Invalid bbox: expected minLon,minLat,maxLon,maxLat in WGS84 (CRS84).'
          );
          return;
        }
      }

      const metadata = await getNotebookMetadata(notebookId);
      if (!metadata) {
        notFound(res, `Notebook not found: ${notebookId}`);
        return;
      }

      const allFeatures =
        await collectNotebookGeoJsonFeaturesForOgc(notebookId);
      const bboxStr =
        req.query.bbox !== undefined && String(req.query.bbox) !== ''
          ? String(req.query.bbox)
          : undefined;
      const filtered = bboxFilter
        ? allFeatures.filter(f => featureIntersectsBbox(f, bboxFilter))
        : allFeatures;
      const numberMatched = filtered.length;
      const page = filtered.slice(offset, offset + limit);
      const numberReturned = page.length;

      const querySuffix = itemsQueryString({
        limit,
        offset,
        bbox: bboxStr,
      });
      const selfHref = ogcUrl(
        `/collections/${encodeURIComponent(notebookId)}/items${querySuffix}`
      );
      const links: Array<{rel: string; href: string; type: string}> = [
        {rel: 'self', href: selfHref, type: 'application/geo+json'},
      ];
      if (offset + numberReturned < numberMatched) {
        const nextHref = ogcUrl(
          `/collections/${encodeURIComponent(notebookId)}/items${itemsQueryString(
            {
              limit,
              offset: offset + limit,
              bbox: bboxStr,
            }
          )}`
        );
        links.push({rel: 'next', href: nextHref, type: 'application/geo+json'});
      }

      setOgcGeoJsonHeaders(res);
      res.json({
        type: 'FeatureCollection',
        numberMatched,
        numberReturned,
        links,
        features: page,
      });
    } catch (e) {
      next(e);
    }
  }
);

ogcRouter.get(
  '/collections/:notebookId/items/:featureId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {notebookId, featureId} = req.params;
      const metadata = await getNotebookMetadata(notebookId);
      if (!metadata) {
        notFound(res, `Notebook not found: ${notebookId}`);
        return;
      }
      const hydrated = await hydrateRecordById(notebookId, featureId);
      if (!hydrated) {
        notFound(res, `Record not found: ${featureId}`);
        return;
      }
      const features = await collectOgcGeoJsonFeaturesForHydratedRecord(
        notebookId,
        hydrated
      );
      const feature = features[0];
      if (!feature) {
        notFound(res, `Record has no exportable geometry: ${featureId}`);
        return;
      }
      setOgcGeoJsonHeaders(res);
      res.json(feature);
    } catch (e) {
      next(e);
    }
  }
);
