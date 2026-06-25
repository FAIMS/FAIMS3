/**
 * Export geospatial data from FAIMS notebooks in GeoJSON, KML, and GeoPackage.
 *
 * Supported output paths:
 * - **Direct stream** — single format written to an HTTP response (`streamNotebookRecordsAs*`)
 * - **Archive append** — one or more formats appended to a ZIP (`appendSpatialFormatsToArchive`)
 *
 * All paths share {@link iterateSpatialFeatures}, which walks notebook records once and
 * emits each spatial feature to every enabled sink. GeoJSON/KML stream inline; GeoPackage
 * collects features into per-layer temp GeoJSON files and converts with ogr2ogr after the pass.
 *
 * GeoPackage layers are named `{form_id}_{geometry_type}` (e.g. `survey_point`), with one
 * layer per form and geometry suffix (Point/MultiPoint share `point`, etc.).
 */

import {
  CompiledNotebookUiSpec,
  DatabaseInterface,
  FieldSummary,
  HydratedDataRecord,
  ProjectDataObject,
  ProjectID,
  buildViewsetFieldSummaries,
  notebookRecordIterator,
} from '@faims3/data-model';
import archiver from 'archiver';
import {createReadStream, createWriteStream} from 'fs';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {PassThrough, pipeline} from 'stream';
import {promisify} from 'util';
import {getDataDb} from '..';
import {assertGdalAvailable, convertLayeredGeoJsonToGeoPackage} from './gdal';
import {getCompiledUiSpecModel} from '../notebooks';
import {buildExportReadyDataCopy} from './stripDeletedRelatedRefs';
import {convertDataForOutput, truncateWithHash} from './utils';

/**
 * Statistics returned from spatial export operations.
 */
export interface SpatialAppendStats {
  /** Geometries written (may differ from record count when records have multiple map fields). */
  featureCount: number;
  filename: string;
  hasSpatialFields: boolean;
}

/**
 * Extracted geometry from a record's spatial field.
 */
interface ExtractedGeometry {
  type: string;
  geometry: any;
  geometrySource: {
    viewsetId: string;
    viewId: string;
    fieldId: string;
    type: string;
  };
}

/**
 * Context required for spatial export operations.
 */
interface SpatialExportContext {
  dataDb: DatabaseInterface<ProjectDataObject>;
  uiSpecification: CompiledNotebookUiSpec;
  viewFieldsMap: Record<string, FieldSummary[]>;
  hasSpatialFields: boolean;
}

/**
 * Result of processing a record for spatial data.
 */
interface ProcessedRecord {
  hrid: string;
  baseProperties: Record<string, any>;
  geometries: ExtractedGeometry[];
}

// ============================================================================
// Core Setup Functions
// ============================================================================

/**
 * Initializes the context required for spatial export operations.
 *
 * @param projectId - The project identifier
 * @returns Context object with database, UI spec, field map, and spatial field status
 */
async function initSpatialExportContext(
  projectId: ProjectID
): Promise<SpatialExportContext> {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getCompiledUiSpecModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  const hasSpatialFields = Object.keys(viewFieldsMap).some(viewsetID =>
    viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
  );

  return {dataDb, uiSpecification, viewFieldsMap, hasSpatialFields};
}

/**
 * Creates a record iterator for spatial export.
 *
 * @param projectId - The project identifier
 * @param context - The spatial export context
 * @returns An async iterator over notebook records
 */
async function createRecordIterator(
  projectId: ProjectID,
  context: SpatialExportContext
) {
  return notebookRecordIterator({
    dataDb: context.dataDb,
    projectId,
    uiSpecification: context.uiSpecification,
    includeAttachments: false,
  });
}

/**
 * Checks if a project has any spatial fields.
 *
 * @param projectId - The project identifier
 * @returns True if the project contains spatial fields
 */
export const projectHasSpatialFields = async (
  projectId: ProjectID
): Promise<boolean> => {
  const context = await initSpatialExportContext(projectId);
  return context.hasSpatialFields;
};

// ============================================================================
// Record Processing
// ============================================================================

/**
 * Process a single record and extract spatial geometries and properties.
 *
 * @param record - The hydrated record to process
 * @param viewFieldsMap - Map of viewId to field summaries
 * @param filenames - Array to track generated filenames for attachments
 * @returns Processed record with hrid, base properties, and extracted geometries
 */
/** Exported for tests — builds GeoJSON/KML feature properties from a hydrated record. */
export async function processRecordForSpatial(
  record: HydratedDataRecord,
  viewFieldsMap: Record<string, FieldSummary[]>,
  filenames: string[],
  dataDb: DatabaseInterface<ProjectDataObject>,
  uiSpecification: CompiledNotebookUiSpec
): Promise<ProcessedRecord> {
  const hrid = record.hrid || record.record_id;
  const viewID = record.type;

  const baseProperties: Record<string, any> = {
    hrid,
    record_id: record.record_id,
    revision_id: record.revision_id,
    type: record.type,
    created_by: record.created_by,
    created_time: record.created.toISOString(),
    updated_by: record.updated_by,
    updated_time: record.updated.toISOString(),
  };

  const geometries: ExtractedGeometry[] = [];
  const data = await buildExportReadyDataCopy({
    viewsetId: viewID,
    data: record.data as Record<string, unknown>,
    viewFieldsMap,
    dataDb,
    uiSpecification,
  });
  const fieldInfos = viewFieldsMap[viewID];

  if (!fieldInfos) {
    return {hrid, baseProperties, geometries};
  }

  // Always add converted data to properties - do this once as it's constant for
  // all spatial entries
  const convertedData = convertDataForOutput(
    fieldInfos,
    data,
    record.annotations,
    hrid,
    filenames,
    viewID
  );

  fieldInfos.forEach(fieldInfo => {
    if (!Object.keys(data).includes(fieldInfo.name)) {
      return;
    }

    const fieldData = data[fieldInfo.name];

    if (isSpatialFieldWithData(fieldInfo, fieldData)) {
      const geometry = extractGeometry(fieldData, fieldInfo, record.record_id);
      if (geometry) {
        geometries.push(geometry);
      }
    }

    Object.assign(baseProperties, convertedData);
  });

  return {hrid, baseProperties, geometries};
}

/**
 * Checks if a field is spatial and contains valid data.
 *
 * @param fieldInfo - Field metadata
 * @param fieldData - Field value
 * @returns True if the field is spatial with valid data
 */
function isSpatialFieldWithData(
  fieldInfo: FieldSummary,
  fieldData: any
): boolean {
  return (
    !!fieldInfo.isSpatial &&
    fieldData !== undefined &&
    fieldData !== null &&
    fieldData !== ''
  );
}

/**
 * Extracts geometry from a spatial field's data.
 *
 * @param fieldData - The field data containing geometry
 * @param fieldInfo - Field metadata
 * @param recordId - Record ID for error logging
 * @returns Extracted geometry or null if extraction fails
 */
function extractGeometry(
  fieldData: any,
  fieldInfo: FieldSummary,
  recordId: string
): ExtractedGeometry | null {
  try {
    let feature: any = {};
    if (fieldData.type === 'FeatureCollection') {
      feature = fieldData['features'][0];
    } else if (fieldData.type === 'Feature') {
      feature = fieldData;
    }

    if (feature?.geometry?.coordinates) {
      return {
        type: feature.type,
        geometry: feature.geometry,
        geometrySource: {
          fieldId: fieldInfo.name,
          viewsetId: fieldInfo.viewsetId,
          type: fieldInfo.type,
          viewId: fieldInfo.viewId,
        },
      };
    }

    console.warn(
      `Encountered geometry which appeared valid but had no geometry or coordinates fields. Field data: ${JSON.stringify(fieldData)}.`
    );
    return null;
  } catch (e) {
    console.error(
      `Issue while converting geometry ${e}. Field data: ${JSON.stringify(fieldData)}. Record: ${recordId}.`
    );
    return null;
  }
}

/**
 * Builds full properties object including geometry source metadata.
 *
 * @param baseProperties - Base record properties
 * @param geometrySource - Geometry source metadata
 * @returns Combined properties object
 */
function buildFeatureProperties(
  baseProperties: Record<string, any>,
  geometrySource: ExtractedGeometry['geometrySource']
): Record<string, any> {
  return {
    ...baseProperties,
    geometry_source_view_id: geometrySource.viewId,
    geometry_source_viewset_id: geometrySource.viewsetId,
    geometry_source_field_id: geometrySource.fieldId,
    geometry_source_type: geometrySource.type,
  };
}

interface SpatialFeatureEmitContext {
  /** Hydrated source record (includes form/viewset id as `type`). */
  record: HydratedDataRecord;
  hrid: string;
  /** Record-level properties shared by all geometries from this record. */
  baseProperties: Record<string, any>;
  geom: ExtractedGeometry;
  /** Full feature properties including geometry-source metadata. */
  properties: Record<string, any>;
}

/**
 * Walks all notebook records once and invokes `onFeature` for each spatial feature.
 *
 * Handles record processing, attachment filename tracking, and property assembly so
 * callers only need to write output in their chosen format(s).
 *
 * @param projectId - Notebook to export
 * @param context - Pre-initialised export context (from {@link initSpatialExportContext})
 * @param onFeature - Called once per geometry; may be async
 */
async function iterateSpatialFeatures(
  projectId: ProjectID,
  context: SpatialExportContext,
  onFeature: (feature: SpatialFeatureEmitContext) => void | Promise<void>
): Promise<void> {
  const filenames: string[] = [];
  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {hrid, baseProperties, geometries} = await processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames,
        context.dataDb,
        context.uiSpecification
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );
        await onFeature({record, hrid, baseProperties, geom, properties});
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }
}

const MAX_GPKG_LAYER_NAME_LENGTH = 63; // GeoPackage table-name limit

const GEOJSON_GEOMETRY_TYPE_SUFFIX: Record<string, string> = {
  Point: 'point',
  MultiPoint: 'point',
  LineString: 'linestring',
  MultiLineString: 'linestring',
  Polygon: 'polygon',
  MultiPolygon: 'polygon',
};

/**
 * Maps a GeoJSON geometry type to the GeoPackage layer suffix.
 * Multi* types share a layer with their simple counterpart.
 */
export function geoJsonGeometryTypeToLayerSuffix(
  geometryType: string
): string | null {
  return GEOJSON_GEOMETRY_TYPE_SUFFIX[geometryType] ?? null;
}

function sanitizeGeoPackageLayerNamePart(part: string): string {
  // GeoPackage/SQLite identifiers: alphanumeric and underscore; must not start with a digit.
  const sanitized = part.replace(/[^a-zA-Z0-9_]/g, '_');
  if (sanitized.length === 0) {
    return '_';
  }
  if (/^[0-9]/.test(sanitized)) {
    return `_${sanitized}`;
  }
  return sanitized;
}

/**
 * Builds a unique GeoPackage layer name: `{form_id}_{geometry_type}`.
 *
 * Collisions after sanitisation are resolved with a numeric suffix. Names longer than
 * {@link MAX_GPKG_LAYER_NAME_LENGTH} characters are truncated with a hash.
 */
export function buildGeoPackageLayerName(
  formId: string,
  geometryType: string,
  usedNames: Set<string> = new Set()
): string | null {
  const geometrySuffix = geoJsonGeometryTypeToLayerSuffix(geometryType);
  if (!geometrySuffix) {
    return null;
  }

  const sanitizedFormId = sanitizeGeoPackageLayerNamePart(formId);
  let baseName = `${sanitizedFormId}_${geometrySuffix}`;
  if (baseName.length > MAX_GPKG_LAYER_NAME_LENGTH) {
    baseName = truncateWithHash(baseName, MAX_GPKG_LAYER_NAME_LENGTH);
  }

  let layerName = baseName;
  let counter = 1;
  while (usedNames.has(layerName)) {
    const suffix = `_${counter}`;
    const truncatedBase = truncateWithHash(
      baseName,
      MAX_GPKG_LAYER_NAME_LENGTH - suffix.length
    );
    layerName = `${truncatedBase}${suffix}`;
    counter++;
  }

  usedNames.add(layerName);
  return layerName;
}

interface LayerGeoJsonBucket {
  layerName: string;
  filePath: string;
  stream: ReturnType<typeof createWriteStream>;
  featureCount: number;
  isFirstFeature: boolean;
}

interface LayeredGeoJsonExportResult {
  featureCount: number;
  layers: Array<{layerName: string; geojsonPath: string}>;
}

/**
 * Collects spatial features into one GeoJSON file per (form, geometry type) layer.
 * Used during GeoPackage export (standalone or as part of a multi-format archive pass).
 */
class GeoPackageLayerCollector {
  private readonly buckets = new Map<string, LayerGeoJsonBucket>();
  private readonly usedLayerNames = new Set<string>();
  featureCount = 0;

  constructor(private readonly outputDir: string) {}

  /**
   * Routes a feature into the appropriate layer bucket, creating the bucket on first use.
   * Unsupported geometry types are skipped with a warning.
   */
  writeFeature(
    formId: string,
    geom: ExtractedGeometry,
    properties: Record<string, any>
  ): void {
    const geometryType = geom.geometry?.type;
    if (typeof geometryType !== 'string') {
      return;
    }

    const bucket = this.getOrCreateBucket(formId, geometryType);
    if (!bucket) {
      return;
    }

    writeGeoJSONFeature(bucket.stream, geom, properties, bucket.isFirstFeature);
    bucket.isFirstFeature = false;
    bucket.featureCount++;
    this.featureCount++;
  }

  /**
   * Closes all layer GeoJSON files and returns paths ready for ogr2ogr conversion.
   */
  async finalize(): Promise<Array<{layerName: string; geojsonPath: string}>> {
    const layers: Array<{layerName: string; geojsonPath: string}> = [];

    for (const bucket of this.buckets.values()) {
      if (bucket.featureCount === 0) {
        continue;
      }

      writeGeoJSONFooter(bucket.stream);
      bucket.stream.end();
      await waitForWriteStream(bucket.stream);
      layers.push({
        layerName: bucket.layerName,
        geojsonPath: bucket.filePath,
      });
    }

    layers.sort((a, b) => a.layerName.localeCompare(b.layerName));
    return layers;
  }

  private getOrCreateBucket(
    formId: string,
    geometryType: string
  ): LayerGeoJsonBucket | null {
    const geometrySuffix = geoJsonGeometryTypeToLayerSuffix(geometryType);
    if (!geometrySuffix) {
      console.warn(
        `Unsupported geometry type for GeoPackage export: ${geometryType}`
      );
      return null;
    }

    const bucketKey = `${formId}\0${geometrySuffix}`; // one bucket per form + geometry suffix
    const existing = this.buckets.get(bucketKey);
    if (existing) {
      return existing;
    }

    const layerName = buildGeoPackageLayerName(
      formId,
      geometryType,
      this.usedLayerNames
    );
    if (!layerName) {
      return null;
    }

    const filePath = join(this.outputDir, `${layerName}.geojson`);
    const stream = createWriteStream(filePath, {encoding: 'utf8'});
    writeGeoJSONHeader(stream);

    const bucket: LayerGeoJsonBucket = {
      layerName,
      filePath,
      stream,
      featureCount: 0,
      isFirstFeature: true,
    };
    this.buckets.set(bucketKey, bucket);
    return bucket;
  }
}

/** Selects which spatial formats to include in an archive export. */
export interface SpatialArchiveFormatConfig {
  /** Single FeatureCollection GeoJSON file in the archive. */
  geojson?: {filename: string};
  /** Single KML Document in the archive. */
  kml?: {filename: string};
  /**
   * GeoPackage (.gpkg) built via layered temp GeoJSON and ogr2ogr.
   * Requires GDAL on the server.
   */
  geopackage?: {filename: string};
}

/** Per-format statistics from {@link appendSpatialFormatsToArchive}. */
export interface SpatialArchiveExportResult {
  /** False when the notebook has no map/spatial fields at all. */
  hasSpatialFields: boolean;
  geojson?: SpatialAppendStats;
  kml?: SpatialAppendStats;
  geopackage?: SpatialAppendStats;
}

// ============================================================================
// GeoJSON Functions
// ============================================================================

/**
 * Writes the GeoJSON header to a stream.
 *
 * @param stream - Writable stream
 */
function writeGeoJSONHeader(stream: NodeJS.WritableStream): void {
  stream.write('{"type":"FeatureCollection","features":[');
}

/**
 * Writes the GeoJSON footer to a stream.
 *
 * @param stream - Writable stream
 */
function writeGeoJSONFooter(stream: NodeJS.WritableStream): void {
  stream.write(']}');
}

/**
 * Writes a GeoJSON feature to a stream.
 *
 * @param stream - Writable stream
 * @param geom - Extracted geometry
 * @param properties - Feature properties
 * @param isFirst - Whether this is the first feature (affects comma handling)
 */
function writeGeoJSONFeature(
  stream: NodeJS.WritableStream,
  geom: ExtractedGeometry,
  properties: Record<string, any>,
  isFirst: boolean
): void {
  const output = {
    type: geom.type,
    geometry: geom.geometry,
    properties,
  };
  stream.write(`${isFirst ? '' : ','}${JSON.stringify(output)}`);
}

// ============================================================================
// KML Functions
// ============================================================================

/**
 * Writes the KML header to a stream.
 *
 * @param stream - Writable stream
 */
function writeKMLHeader(stream: NodeJS.WritableStream): void {
  stream.write('<?xml version="1.0" encoding="UTF-8"?>');
  stream.write('<kml xmlns="http://www.opengis.net/kml/2.2">');
  stream.write('<Document>');
}

/**
 * Writes the KML footer to a stream.
 *
 * @param stream - Writable stream
 */
function writeKMLFooter(stream: NodeJS.WritableStream): void {
  stream.write('</Document>');
  stream.write('</kml>');
}

/**
 * Writes a KML placemark to a stream.
 *
 * @param stream - Writable stream
 * @param name - Placemark name
 * @param geometry - GeoJSON geometry to convert
 * @param properties - Properties for ExtendedData
 * @param recordId - Record ID for error logging
 * @returns True if placemark was written successfully
 */
function writeKMLPlacemark(
  stream: NodeJS.WritableStream,
  name: string,
  geometry: any,
  properties: Record<string, any>,
  recordId: string
): boolean {
  try {
    const escapedName = escapeXml(name);
    const geometryKML = convertGeometryToKML(geometry);
    const extendedData = buildExtendedData(properties);

    stream.write('<Placemark>');
    stream.write(`<name>${escapedName}</name>`);
    stream.write(extendedData);
    stream.write(geometryKML);
    stream.write('</Placemark>');
    return true;
  } catch (e) {
    console.error(
      `Error converting geometry to KML for record ${recordId}: ${e}`
    );
    return false;
  }
}

/**
 * Escapes XML special characters.
 *
 * @param unsafe - String to escape
 * @returns XML-escaped string
 */
function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts GeoJSON geometry to KML geometry markup.
 *
 * @param geometry - GeoJSON geometry object
 * @returns KML geometry string
 * @throws Error if geometry type is unsupported
 */
function convertGeometryToKML(geometry: any): string {
  const type = geometry.type;
  const coords = geometry.coordinates;

  const formatCoords = (coordArray: any): string => {
    if (typeof coordArray[0] === 'number') {
      return coordArray.length === 3
        ? `${coordArray[0]},${coordArray[1]},${coordArray[2]}`
        : `${coordArray[0]},${coordArray[1]},0`;
    }
    return coordArray.map((coord: any) => formatCoords(coord)).join(' ');
  };

  const formatPolygon = (polyCoords: any[]): string => {
    const outer = `<outerBoundaryIs><LinearRing><coordinates>${formatCoords(polyCoords[0])}</coordinates></LinearRing></outerBoundaryIs>`;
    const inner = polyCoords
      .slice(1)
      .map(
        (ring: any) =>
          `<innerBoundaryIs><LinearRing><coordinates>${formatCoords(ring)}</coordinates></LinearRing></innerBoundaryIs>`
      )
      .join('');
    return `<Polygon>${outer}${inner}</Polygon>`;
  };

  switch (type) {
    case 'Point':
      return `<Point><coordinates>${formatCoords(coords)}</coordinates></Point>`;
    case 'LineString':
      return `<LineString><coordinates>${formatCoords(coords)}</coordinates></LineString>`;
    case 'Polygon':
      return formatPolygon(coords);
    case 'MultiPoint':
      return `<MultiGeometry>${coords
        .map(
          (coord: any) =>
            `<Point><coordinates>${formatCoords(coord)}</coordinates></Point>`
        )
        .join('')}</MultiGeometry>`;
    case 'MultiLineString':
      return `<MultiGeometry>${coords
        .map(
          (lineCoords: any) =>
            `<LineString><coordinates>${formatCoords(lineCoords)}</coordinates></LineString>`
        )
        .join('')}</MultiGeometry>`;
    case 'MultiPolygon':
      return `<MultiGeometry>${coords
        .map((polyCoords: any) => formatPolygon(polyCoords))
        .join('')}</MultiGeometry>`;
    default:
      throw new Error(`Unsupported geometry type: ${type}`);
  }
}

/**
 * Builds KML ExtendedData section from properties.
 *
 * @param properties - Key-value pairs to include
 * @returns KML ExtendedData markup
 */
function buildExtendedData(properties: Record<string, any>): string {
  const dataElements = Object.entries(properties)
    .map(([key, value]) => {
      const displayName = escapeXml(key);
      let displayValue: string;
      if (value === null || value === undefined) {
        displayValue = '';
      } else if (typeof value === 'object') {
        displayValue = escapeXml(JSON.stringify(value));
      } else {
        displayValue = escapeXml(String(value));
      }
      return `<Data name="${displayName}"><value>${displayValue}</value></Data>`;
    })
    .join('');

  return `<ExtendedData>${dataElements}</ExtendedData>`;
}

// ============================================================================
// Stream Utilities
// ============================================================================

/**
 * Waits for a PassThrough stream to finish.
 *
 * @param stream - PassThrough stream to wait on
 * @returns Promise that resolves when stream finishes
 */
function waitForStream(stream: PassThrough): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/**
 * Waits for a file write stream to finish flushing to disk.
 */
function waitForWriteStream(
  stream: ReturnType<typeof createWriteStream>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/**
 * Creates initial stats object for spatial export.
 *
 * @param filename - Output filename
 * @param hasSpatialFields - Whether project has spatial fields
 * @returns Initialized stats object
 */
function createInitialStats(
  filename: string,
  hasSpatialFields: boolean
): SpatialAppendStats {
  return {
    featureCount: 0,
    filename,
    hasSpatialFields,
  };
}

// ============================================================================
// Archive Export Functions
// ============================================================================

/**
 * Exports spatial data to one or more archive entries in a single database pass.
 *
 * Each enabled format in `formats` receives every spatial feature from the iteration.
 * GeoJSON and KML are streamed directly into the archive; GeoPackage is built via
 * layered temp GeoJSON files and ogr2ogr after the pass completes.
 *
 * @param projectId - Project identifier
 * @param archive - Archiver instance to append to
 * @param formats - Which output formats to produce (at least one required)
 * @returns Statistics per requested format and whether the project has spatial fields
 */
export const appendSpatialFormatsToArchive = async ({
  projectId,
  archive,
  formats,
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  formats: SpatialArchiveFormatConfig;
}): Promise<SpatialArchiveExportResult> => {
  const context = await initSpatialExportContext(projectId);
  const result: SpatialArchiveExportResult = {
    hasSpatialFields: context.hasSpatialFields,
  };

  if (formats.geojson) {
    result.geojson = createInitialStats(
      formats.geojson.filename,
      context.hasSpatialFields
    );
  }
  if (formats.kml) {
    result.kml = createInitialStats(
      formats.kml.filename,
      context.hasSpatialFields
    );
  }
  if (formats.geopackage) {
    result.geopackage = createInitialStats(
      formats.geopackage.filename,
      context.hasSpatialFields
    );
  }

  if (!context.hasSpatialFields) {
    return result;
  }

  const wantsGeoJSON = !!formats.geojson;
  const wantsKML = !!formats.kml;
  const wantsGeoPackage = !!formats.geopackage;

  if (wantsGeoPackage) {
    await assertGdalAvailable();
  }

  // --- Setup output sinks (streams and/or temp files) ---
  let geojsonStream: PassThrough | undefined;
  let kmlStream: PassThrough | undefined;
  let isFirstGeoJSONFeature = true;
  let gpkgCollector: GeoPackageLayerCollector | undefined;
  let tempDir: string | undefined;
  let geopackagePath: string | undefined;

  if (wantsGeoJSON) {
    geojsonStream = new PassThrough();
    archive.append(geojsonStream, {name: formats.geojson!.filename});
    writeGeoJSONHeader(geojsonStream);
  }

  if (wantsKML) {
    kmlStream = new PassThrough();
    archive.append(kmlStream, {name: formats.kml!.filename});
    writeKMLHeader(kmlStream);
  }

  if (wantsGeoPackage) {
    tempDir = await mkdtemp(join(tmpdir(), 'faims-gpkg-archive-'));
    geopackagePath = join(tempDir, 'export.gpkg');
    gpkgCollector = new GeoPackageLayerCollector(tempDir);
  }

  // --- Single DB pass: fan each feature out to every enabled format ---
  await iterateSpatialFeatures(
    projectId,
    context,
    ({record, hrid, geom, properties}) => {
      if (geojsonStream) {
        writeGeoJSONFeature(
          geojsonStream,
          geom,
          properties,
          isFirstGeoJSONFeature
        );
        isFirstGeoJSONFeature = false;
        result.geojson!.featureCount++;
      }

      if (kmlStream) {
        if (
          writeKMLPlacemark(
            kmlStream,
            hrid,
            geom.geometry,
            properties,
            record.record_id
          )
        ) {
          result.kml!.featureCount++;
        }
      }

      if (gpkgCollector) {
        gpkgCollector.writeFeature(record.type, geom, properties);
      }
    }
  );

  // --- Finalize: close streams, convert GeoPackage layers, append to archive ---
  const streamFinalizeTasks: Promise<void>[] = [];

  if (geojsonStream) {
    writeGeoJSONFooter(geojsonStream);
    geojsonStream.end();
    streamFinalizeTasks.push(waitForStream(geojsonStream));
  }

  if (kmlStream) {
    writeKMLFooter(kmlStream);
    kmlStream.end();
    streamFinalizeTasks.push(waitForStream(kmlStream));
  }

  if (gpkgCollector && geopackagePath && tempDir) {
    try {
      const layers = await gpkgCollector.finalize();
      result.geopackage!.featureCount = gpkgCollector.featureCount;

      if (gpkgCollector.featureCount > 0) {
        await convertLayeredGeoJsonToGeoPackage({
          layers,
          geopackagePath,
        });

        await new Promise<void>((resolve, reject) => {
          const gpkgStream = createReadStream(geopackagePath!);
          gpkgStream.on('error', reject);
          gpkgStream.on('close', resolve);
          archive.append(gpkgStream, {name: formats.geopackage!.filename});
        });
      }
    } finally {
      await rm(tempDir, {recursive: true, force: true});
    }
  }

  await Promise.all(streamFinalizeTasks);

  return result;
};

/**
 * Appends a GeoJSON file to an existing archive using a single database pass.
 *
 * @see appendSpatialFormatsToArchive
 */
export const appendGeoJSONToArchive = async ({
  projectId,
  archive,
  filename,
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  filename: string;
}): Promise<SpatialAppendStats> => {
  const {geojson} = await appendSpatialFormatsToArchive({
    projectId,
    archive,
    formats: {geojson: {filename}},
  });
  return geojson!;
};

/**
 * Appends a KML file to an existing archive using a single database pass.
 *
 * @see appendSpatialFormatsToArchive
 */
export const appendKMLToArchive = async ({
  projectId,
  archive,
  filename,
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  filename: string;
}): Promise<SpatialAppendStats> => {
  const {kml} = await appendSpatialFormatsToArchive({
    projectId,
    archive,
    formats: {kml: {filename}},
  });
  return kml!;
};

/**
 * Appends both GeoJSON and KML files to an archive in a single database pass.
 *
 * @see appendSpatialFormatsToArchive
 */
export const appendBothSpatialFormatsToArchive = async ({
  projectId,
  archive,
  geojsonFilename,
  kmlFilename,
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  geojsonFilename: string;
  kmlFilename: string;
}): Promise<{geojson: SpatialAppendStats; kml: SpatialAppendStats}> => {
  const {geojson, kml} = await appendSpatialFormatsToArchive({
    projectId,
    archive,
    formats: {
      geojson: {filename: geojsonFilename},
      kml: {filename: kmlFilename},
    },
  });
  return {geojson: geojson!, kml: kml!};
};

/**
 * Appends a GeoPackage file to an archive using a single database pass.
 *
 * Layers are grouped by form and geometry type. Requires GDAL (`ogr2ogr`).
 *
 * @see appendSpatialFormatsToArchive
 */
export const appendGeoPackageToArchive = async ({
  projectId,
  archive,
  filename,
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  filename: string;
}): Promise<SpatialAppendStats> => {
  const {geopackage} = await appendSpatialFormatsToArchive({
    projectId,
    archive,
    formats: {geopackage: {filename}},
  });
  return geopackage!;
};

// ============================================================================
// Direct Stream Export Functions
// ============================================================================

const pipelineAsync = promisify(pipeline);

/**
 * Writes one GeoJSON FeatureCollection per (form, geometry type) layer to `outputDir`.
 *
 * Intermediate step for GeoPackage export; output files are consumed by ogr2ogr.
 */
async function writeNotebookRecordsAsLayeredGeoJSONToDir(
  projectId: ProjectID,
  outputDir: string,
  context?: SpatialExportContext
): Promise<LayeredGeoJsonExportResult> {
  const exportContext = context ?? (await initSpatialExportContext(projectId));

  if (!exportContext.hasSpatialFields) {
    throw new Error(
      'No spatial fields in any view, cannot produce a GeoPackage export!'
    );
  }

  const collector = new GeoPackageLayerCollector(outputDir);

  await iterateSpatialFeatures(
    projectId,
    exportContext,
    ({record, geom, properties}) => {
      collector.writeFeature(record.type, geom, properties);
    }
  );

  const layers = await collector.finalize();

  return {featureCount: collector.featureCount, layers};
}

/**
 * Builds a `.gpkg` file from notebook spatial data via layered GeoJSON and ogr2ogr.
 *
 * @returns Total feature count written (0 when no spatial features exist)
 */
async function buildGeoPackageFromProject(
  projectId: ProjectID,
  tempDir: string,
  geopackagePath: string,
  context: SpatialExportContext
): Promise<number> {
  const {featureCount, layers} =
    await writeNotebookRecordsAsLayeredGeoJSONToDir(
      projectId,
      tempDir,
      context
    );

  if (featureCount === 0) {
    return 0;
  }

  await convertLayeredGeoJsonToGeoPackage({
    layers,
    geopackagePath,
  });

  return featureCount;
}

/**
 * Streams notebook records as GeoJSON directly to a writable stream.
 *
 * @param projectId - Project identifier
 * @param res - Writable stream for output
 * @throws Error if no spatial fields exist in the project
 */
export const streamNotebookRecordsAsGeoJSON = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
): Promise<void> => {
  const context = await initSpatialExportContext(projectId);

  if (!context.hasSpatialFields) {
    res.end();
    throw new Error(
      'No spatial fields in any view, cannot produce a GeoJSON export!'
    );
  }

  writeGeoJSONHeader(res);

  let isFirstFeature = true;
  await iterateSpatialFeatures(projectId, context, ({geom, properties}) => {
    writeGeoJSONFeature(res, geom, properties, isFirstFeature);
    isFirstFeature = false;
  });

  writeGeoJSONFooter(res);
  res.end();
};

/**
 * Streams notebook records as GeoPackage via a temp GeoJSON file and ogr2ogr.
 *
 * Not a true end-to-end stream: the full `.gpkg` is materialised in a temp directory
 * before being piped to `res`. Suitable for typical notebook sizes; large projects may
 * incur noticeable disk use and latency.
 *
 * @param projectId - Project identifier
 * @param res - Writable stream for output
 * @throws Error if no spatial fields exist or GDAL is unavailable
 */
export const streamNotebookRecordsAsGeoPackage = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
): Promise<void> => {
  const context = await initSpatialExportContext(projectId);

  if (!context.hasSpatialFields) {
    res.end();
    throw new Error(
      'No spatial fields in any view, cannot produce a GeoPackage export!'
    );
  }

  await assertGdalAvailable();

  const tempDir = await mkdtemp(join(tmpdir(), 'faims-gpkg-export-'));
  const geopackagePath = join(tempDir, 'export.gpkg');

  try {
    const featureCount = await buildGeoPackageFromProject(
      projectId,
      tempDir,
      geopackagePath,
      context
    );

    if (featureCount === 0) {
      res.end();
      return;
    }

    await pipelineAsync(createReadStream(geopackagePath), res);
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
};

/**
 * Streams notebook records as KML directly to a writable stream.
 *
 * @param projectId - Project identifier
 * @param res - Writable stream for output
 * @throws Error if no spatial fields exist in the project
 */
export const streamNotebookRecordsAsKML = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
): Promise<void> => {
  const context = await initSpatialExportContext(projectId);

  if (!context.hasSpatialFields) {
    res.end();
    throw new Error(
      'No spatial fields in any view, cannot produce a KML export!'
    );
  }

  writeKMLHeader(res);

  await iterateSpatialFeatures(
    projectId,
    context,
    ({record, hrid, geom, properties}) => {
      writeKMLPlacemark(res, hrid, geom.geometry, properties, record.record_id);
    }
  );

  writeKMLFooter(res);
  res.end();
};
