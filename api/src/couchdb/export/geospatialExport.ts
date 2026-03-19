/**
 * Export geospatial data from FAIMS in various formats.
 *
 * All export functions use a single database pass for efficiency,
 * routing records to the appropriate output based on their type.
 */

import {
  DatabaseInterface,
  FieldSummary,
  HydratedDataRecord,
  ProjectDataObject,
  ProjectID,
  buildViewsetFieldSummaries,
  notebookRecordIterator,
} from '@faims3/data-model';

/** Options for layer GeoJSON/GML stream (paging). */
export interface StreamLayerGeoJSONOptions {
  resultOffset?: number;
  resultRecordCount?: number;
  /** CRS name to place in GML geometry elements (e.g. urn:ogc:def:crs:OGC:1.3:CRS84). */
  srsName?: string;
  /** GeoJSON uses lon/lat; EPSG:4326 commonly expects lat/lon in GML. */
  axisOrder?: 'lonlat' | 'latlon';
}
import archiver from 'archiver';
import {PassThrough} from 'stream';
import {getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';
import {convertDataForOutput} from './utils';

/**
 * Statistics returned from spatial export operations.
 */
export interface SpatialAppendStats {
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
export interface SpatialExportContext {
  dataDb: DatabaseInterface<ProjectDataObject>;
  uiSpecification: any;
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
export async function initSpatialExportContext(
  projectId: ProjectID
): Promise<SpatialExportContext> {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
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
 * @returns An async iterator over notebook records (HydratedDataRecord)
 */
export async function createRecordIterator(
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
function processRecordForSpatial(
  record: HydratedDataRecord,
  viewFieldsMap: Record<string, FieldSummary[]>,
  filenames: string[]
): ProcessedRecord {
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
  const data = record.data;
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
 * Appends a GeoJSON file to an existing archive using a single database pass.
 *
 * @param projectId - Project identifier
 * @param archive - Archiver instance to append to
 * @param filename - Filename in the archive
 * @returns Statistics about the exported GeoJSON
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
  const context = await initSpatialExportContext(projectId);
  const stats = createInitialStats(filename, context.hasSpatialFields);

  if (!context.hasSpatialFields) {
    return stats;
  }

  const geojsonStream = new PassThrough();
  archive.append(geojsonStream, {name: filename});

  const filenames: string[] = [];
  writeGeoJSONHeader(geojsonStream);

  let isFirstFeature = true;
  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );
        writeGeoJSONFeature(geojsonStream, geom, properties, isFirstFeature);
        isFirstFeature = false;
        stats.featureCount++;
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  writeGeoJSONFooter(geojsonStream);
  geojsonStream.end();
  await waitForStream(geojsonStream);

  return stats;
};

/**
 * Appends a KML file to an existing archive using a single database pass.
 *
 * @param projectId - Project identifier
 * @param archive - Archiver instance to append to
 * @param filename - Filename in the archive
 * @returns Statistics about the exported KML
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
  const context = await initSpatialExportContext(projectId);
  const stats = createInitialStats(filename, context.hasSpatialFields);

  if (!context.hasSpatialFields) {
    return stats;
  }

  const kmlStream = new PassThrough();
  archive.append(kmlStream, {name: filename});

  const filenames: string[] = [];
  writeKMLHeader(kmlStream);

  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {hrid, baseProperties, geometries} = processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );
        if (
          writeKMLPlacemark(
            kmlStream,
            hrid,
            geom.geometry,
            properties,
            record.record_id
          )
        ) {
          stats.featureCount++;
        }
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  writeKMLFooter(kmlStream);
  kmlStream.end();
  await waitForStream(kmlStream);

  return stats;
};

/**
 * Appends both GeoJSON and KML files to an archive in a single database pass.
 * Most efficient approach when both formats are needed.
 *
 * @param projectId - Project identifier
 * @param archive - Archiver instance to append to
 * @param geojsonFilename - Filename for GeoJSON output
 * @param kmlFilename - Filename for KML output
 * @returns Statistics about both exports
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
  const context = await initSpatialExportContext(projectId);
  const geojsonStats = createInitialStats(
    geojsonFilename,
    context.hasSpatialFields
  );
  const kmlStats = createInitialStats(kmlFilename, context.hasSpatialFields);

  if (!context.hasSpatialFields) {
    return {geojson: geojsonStats, kml: kmlStats};
  }

  const geojsonStream = new PassThrough();
  const kmlStream = new PassThrough();

  archive.append(geojsonStream, {name: geojsonFilename});
  archive.append(kmlStream, {name: kmlFilename});

  const filenames: string[] = [];

  writeGeoJSONHeader(geojsonStream);
  writeKMLHeader(kmlStream);

  let isFirstGeoJSONFeature = true;
  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {hrid, baseProperties, geometries} = processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );

        // Write GeoJSON feature
        writeGeoJSONFeature(
          geojsonStream,
          geom,
          properties,
          isFirstGeoJSONFeature
        );
        isFirstGeoJSONFeature = false;
        geojsonStats.featureCount++;

        // Write KML placemark
        if (
          writeKMLPlacemark(
            kmlStream,
            hrid,
            geom.geometry,
            properties,
            record.record_id
          )
        ) {
          kmlStats.featureCount++;
        }
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  writeGeoJSONFooter(geojsonStream);
  geojsonStream.end();

  writeKMLFooter(kmlStream);
  kmlStream.end();

  await Promise.all([waitForStream(geojsonStream), waitForStream(kmlStream)]);

  return {geojson: geojsonStats, kml: kmlStats};
};

// ============================================================================
// Direct Stream Export Functions
// ============================================================================

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

  const filenames: string[] = [];
  writeGeoJSONHeader(res);

  let isFirstFeature = true;
  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );
        writeGeoJSONFeature(res, geom, properties, isFirstFeature);
        isFirstFeature = false;
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  writeGeoJSONFooter(res);
  res.end();
};

/**
 * Streams a single layer (viewset) as GeoJSON to the response, using
 * permission-filtered hydrated records. Used by the ESRI feature service.
 *
 * @param context - Spatial export context from initSpatialExportContext
 * @param formId - Viewset/form ID for this layer
 * @param hydratedRecords - Async iterable of hydrated records (same formId)
 * @param res - Writable stream for output
 * @param options - Optional resultOffset and resultRecordCount for paging
 */
export const streamLayerAsGeoJSON = async (
  context: SpatialExportContext,
  formId: string,
  hydratedRecords: AsyncIterable<HydratedDataRecord>,
  res: NodeJS.WritableStream,
  options: StreamLayerGeoJSONOptions = {}
): Promise<void> => {
  const {resultOffset = 0, resultRecordCount} = options;
  const filenames: string[] = [];
  writeGeoJSONHeader(res);

  let featureIndex = 0;
  let written = 0;
  let isFirstFeature = true;
  const limit = resultRecordCount ?? Infinity;

  outer: for await (const record of hydratedRecords) {
    if (record.type !== formId) continue;
    const {baseProperties, geometries} = processRecordForSpatial(
      record,
      context.viewFieldsMap,
      filenames
    );
    for (const geom of geometries) {
      if (featureIndex < resultOffset) {
        featureIndex++;
        continue;
      }
      if (written >= limit) break outer;
      const properties = buildFeatureProperties(
        baseProperties,
        geom.geometrySource
      );
      writeGeoJSONFeature(res, geom, properties, isFirstFeature);
      isFirstFeature = false;
      written++;
      featureIndex++;
    }
  }

  writeGeoJSONFooter(res);
  res.end();
};

// ============================================================================
// GML 3.2 (WFS GetFeature) helpers
// ============================================================================

function escapeXmlForGml(s: string): string {
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function geoJsonGeometryToGml(
  geom: {
    type: string;
    coordinates?: any;
  },
  srsName: string,
  axisOrder: 'lonlat' | 'latlon'
): string {
  if (!geom || !geom.type) return '';

  const coords = geom.coordinates;
  const swap = axisOrder === 'latlon';
  const srsEscaped = escapeXmlForGml(srsName);
  const srsAttr = ` srsName="${srsEscaped}"`;

  const posFromLonLat = (lon: number, lat: number): string =>
    swap ? `${lat} ${lon}` : `${lon} ${lat}`;

  if (geom.type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    return `<gml:Point xmlns:gml="http://www.opengis.net/gml/3.2"${srsAttr}><gml:pos>${posFromLonLat(lon, lat)}</gml:pos></gml:Point>`;
  }

  if (geom.type === 'LineString' && Array.isArray(coords)) {
    const points = coords as any[];
    const posList = points
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => posFromLonLat(Number(p[0]), Number(p[1])))
      .join(' ');
    return `<gml:LineString xmlns:gml="http://www.opengis.net/gml/3.2"${srsAttr}><gml:posList>${posList}</gml:posList></gml:LineString>`;
  }

  if (
    geom.type === 'Polygon' &&
    Array.isArray(coords) &&
    Array.isArray(coords[0])
  ) {
    // GeoJSON polygon is [ [ [lon,lat], ... ] ] (first ring is exterior)
    const ring = coords[0] as any[];
    const posList = ring
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => posFromLonLat(Number(p[0]), Number(p[1])))
      .join(' ');
    return `<gml:Polygon xmlns:gml="http://www.opengis.net/gml/3.2"${srsAttr}><gml:exterior><gml:LinearRing><gml:posList>${posList}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
  }

  return '';
}

/**
 * Streams a single layer as GML 3.2 to the response (WFS GetFeature format).
 */
export const streamLayerAsGML = async (
  context: SpatialExportContext,
  formId: string,
  hydratedRecords: AsyncIterable<HydratedDataRecord>,
  res: NodeJS.WritableStream,
  options: StreamLayerGeoJSONOptions = {}
): Promise<void> => {
  const {
    resultOffset = 0,
    resultRecordCount,
    srsName = 'urn:ogc:def:crs:OGC:1.3:CRS84',
    axisOrder = 'lonlat',
  } = options;
  const filenames: string[] = [];
  const ns = 'http://www.faims.org/notebook';
  const featureElName = formId.replace(/[^A-Za-z0-9_-]/g, '_');
  let featureIndex = 0;
  let written = 0;
  const limit = resultRecordCount ?? Infinity;

  res.write(`<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:faims="${ns}">
`);

  outer: for await (const record of hydratedRecords) {
    if (record.type !== formId) continue;
    const {baseProperties, geometries} = processRecordForSpatial(
      record,
      context.viewFieldsMap,
      filenames
    );
    for (const geom of geometries) {
      if (featureIndex < resultOffset) {
        featureIndex++;
        continue;
      }
      if (written >= limit) break outer;
      const properties = buildFeatureProperties(
        baseProperties,
        geom.geometrySource
      );
      const fid = `fid-${String(properties.record_id ?? featureIndex)}-${featureIndex}`;
      const geomFieldElName = geom.geometrySource.fieldId.replace(
        /[^A-Za-z0-9_-]/g,
        '_'
      );
      const gmlGeom = geoJsonGeometryToGml(
        geom.geometry,
        srsName,
        axisOrder
      );
      const propLines = Object.entries(properties)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => {
          const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
          const safeK = k.replace(/[^A-Za-z0-9_-]/g, '_');
          return `    <faims:${safeK}>${escapeXmlForGml(val)}</faims:${safeK}>`;
        })
        .join('\n');
      res.write(`  <gml:featureMember>
  <faims:${featureElName} gml:id="${escapeXmlForGml(fid)}">
    <faims:${geomFieldElName}>${gmlGeom}</faims:${geomFieldElName}>
${propLines ? '\n' + propLines + '\n' : ''}  </faims:${featureElName}>
  </gml:featureMember>
`);
      written++;
      featureIndex++;
    }
  }

  res.write('</wfs:FeatureCollection>');
  res.end();
};

/**
 * Counts features (geometries) for a single layer without streaming.
 * Used by WFS GetFeature when RESULTTYPE=hits.
 */
export const countLayerFeatures = async (
  context: SpatialExportContext,
  formId: string,
  hydratedRecords: AsyncIterable<HydratedDataRecord>
): Promise<number> => {
  const filenames: string[] = [];
  let total = 0;
  for await (const record of hydratedRecords) {
    if (record.type !== formId) continue;
    const {geometries} = processRecordForSpatial(
      record,
      context.viewFieldsMap,
      filenames
    );
    total += geometries.length;
  }
  return total;
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

  const filenames: string[] = [];
  writeKMLHeader(res);

  const iterator = await createRecordIterator(projectId, context);
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {hrid, baseProperties, geometries} = processRecordForSpatial(
        record,
        context.viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = buildFeatureProperties(
          baseProperties,
          geom.geometrySource
        );
        writeKMLPlacemark(
          res,
          hrid,
          geom.geometry,
          properties,
          record.record_id
        );
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  writeKMLFooter(res);
  res.end();
};
