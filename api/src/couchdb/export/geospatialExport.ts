/**
 * Description:
 *    Export geospatial data from FAIMS in various formats
 *
 * All export functions use a single database pass for efficiency,
 * routing records to the appropriate output based on their type.
 */

import {
  ProjectID,
  buildViewsetFieldSummaries,
  notebookRecordIterator,
  FieldSummary,
} from '@faims3/data-model';
import {PassThrough} from 'stream';
import archiver from 'archiver';
import {getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';
import {convertDataForOutput} from './utils';

/**
 * Statistics returned from spatial export operations
 */
export interface SpatialAppendStats {
  featureCount: number;
  filename: string;
  hasSpatialFields: boolean;
}

/**
 * Checks if a project has any spatial fields
 */
export const projectHasSpatialFields = async (
  projectId: ProjectID
): Promise<boolean> => {
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  return Array.from(Object.keys(viewFieldsMap)).some(viewsetID =>
    viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
  );
};

/**
 * Extracted geometry from a record's spatial field
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
 * Process a single record and extract any spatial geometries from it.
 * Also builds the base properties object for the record.
 *
 * @param record - The hydrated record
 * @param viewFieldsMap - Map of viewId to field summaries
 * @param filenames - Array to track generated filenames
 * @returns Object containing base properties and array of extracted geometries
 */
function processRecordForSpatial(
  record: any,
  viewFieldsMap: Record<string, FieldSummary[]>,
  filenames: string[]
): {
  baseProperties: Record<string, any>;
  geometries: ExtractedGeometry[];
} {
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
    // Unknown view type - return empty geometries
    return {baseProperties, geometries};
  }

  fieldInfos.forEach(fieldInfo => {
    if (Object.keys(data).includes(fieldInfo.name)) {
      const fieldData = data[fieldInfo.name];

      // Check if this is a spatial field with valid data
      if (
        fieldInfo.isSpatial &&
        fieldData !== undefined &&
        fieldData !== null &&
        fieldData !== '' &&
        !!fieldInfo
      ) {
        try {
          let feature: any = {};
          if (fieldData.type === 'FeatureCollection') {
            feature = fieldData['features'][0];
          } else if (fieldData.type === 'Feature') {
            feature = fieldData;
          }

          if (feature && feature.geometry && feature.geometry.coordinates) {
            geometries.push({
              type: feature.type,
              geometry: feature.geometry,
              geometrySource: {
                fieldId: fieldInfo.name,
                viewsetId: fieldInfo.viewsetId,
                type: fieldInfo.type,
                viewId: fieldInfo.viewId,
              },
            });
          } else {
            console.warn(
              `Encountered geometry which appeared valid but had no geometry or coordinates fields. Field data: ${JSON.stringify(fieldData)}.`
            );
          }
        } catch (e) {
          console.error(
            `Issue while converting geometry ${e}. Field data: ${JSON.stringify(fieldData)}. Record: ${record?.record_id}.`
          );
        }
      }

      // Always add converted data to properties (for non-spatial fields too)
      const convertedData = convertDataForOutput(
        fieldInfos,
        data,
        record.annotations,
        hrid,
        filenames,
        viewID
      );

      for (const [key, value] of Object.entries(convertedData)) {
        baseProperties[key] = value;
      }
    }
  });

  return {baseProperties, geometries};
}

/**
 * Appends a GeoJSON file to an existing archive using a single database pass.
 *
 * @param projectId - Project ID
 * @param archive - Archiver instance to append to
 * @param filename - Filename in the archive (e.g., 'spatial/export.geojson')
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
  const stats: SpatialAppendStats = {
    featureCount: 0,
    filename,
    hasSpatialFields: false,
  };

  // Get the database and UI spec
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  // Check for spatial fields
  stats.hasSpatialFields = Array.from(Object.keys(viewFieldsMap)).some(
    viewsetID => viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
  );

  if (!stats.hasSpatialFields) {
    return stats;
  }

  // Create a PassThrough stream for the archive
  const geojsonStream = new PassThrough();
  archive.append(geojsonStream, {name: filename});

  // Track filenames for attachment references
  const filenames: string[] = [];

  // Write header
  geojsonStream.write('{"type":"FeatureCollection","features":[');

  let isFirstFeature = true;

  // Single iteration through ALL records (no viewID filter)
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    // No viewID - iterate all records in one pass
    includeAttachments: false,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        viewFieldsMap,
        filenames
      );

      // Write each geometry as a GeoJSON feature
      for (const geom of geometries) {
        const output = {
          type: geom.type,
          geometry: geom.geometry,
          properties: {
            ...baseProperties,
            geometry_source_view_id: geom.geometrySource.viewId,
            geometry_source_viewset_id: geom.geometrySource.viewsetId,
            geometry_source_field_id: geom.geometrySource.fieldId,
            geometry_source_type: geom.geometrySource.type,
          },
        };

        geojsonStream.write(
          `${isFirstFeature ? '' : ','}${JSON.stringify(output)}`
        );
        isFirstFeature = false;
        stats.featureCount++;
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // Close the GeoJSON
  geojsonStream.write(']}');
  geojsonStream.end();

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    geojsonStream.on('finish', resolve);
    geojsonStream.on('error', reject);
  });

  return stats;
};

/**
 * Appends a KML file to an existing archive using a single database pass.
 *
 * @param projectId - Project ID
 * @param archive - Archiver instance to append to
 * @param filename - Filename in the archive (e.g., 'spatial/export.kml')
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
  const stats: SpatialAppendStats = {
    featureCount: 0,
    filename,
    hasSpatialFields: false,
  };

  // Get the database and UI spec
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  // Check for spatial fields
  stats.hasSpatialFields = Array.from(Object.keys(viewFieldsMap)).some(
    viewsetID => viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
  );

  if (!stats.hasSpatialFields) {
    return stats;
  }

  // Create a PassThrough stream for the archive
  const kmlStream = new PassThrough();
  archive.append(kmlStream, {name: filename});

  // Track filenames
  const filenames: string[] = [];

  // Write KML header
  kmlStream.write('<?xml version="1.0" encoding="UTF-8"?>');
  kmlStream.write('<kml xmlns="http://www.opengis.net/kml/2.2">');
  kmlStream.write('<Document>');

  // Single iteration through ALL records (no viewID filter)
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    // No viewID - iterate all records in one pass
    includeAttachments: false,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const hrid = record.hrid || record.record_id;
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        viewFieldsMap,
        filenames
      );

      // Write each geometry as a KML Placemark
      for (const geom of geometries) {
        const properties = {
          ...baseProperties,
          geometry_source_view_id: geom.geometrySource.viewId,
          geometry_source_viewset_id: geom.geometrySource.viewsetId,
          geometry_source_field_id: geom.geometrySource.fieldId,
          geometry_source_type: geom.geometrySource.type,
        };

        try {
          const name = escapeXml(hrid);
          const geometryKML = convertGeometryToKML(geom.geometry);
          const extendedData = buildExtendedData(properties);

          kmlStream.write('<Placemark>');
          kmlStream.write(`<name>${name}</name>`);
          kmlStream.write(extendedData);
          kmlStream.write(geometryKML);
          kmlStream.write('</Placemark>');
          stats.featureCount++;
        } catch (e) {
          console.error(
            `Error converting geometry to KML for record ${record.record_id}: ${e}`
          );
        }
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // Close KML document
  kmlStream.write('</Document>');
  kmlStream.write('</kml>');
  kmlStream.end();

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    kmlStream.on('finish', resolve);
    kmlStream.on('error', reject);
  });

  return stats;
};

/**
 * Appends both GeoJSON and KML files to an archive in a single database pass.
 *
 * This is the most efficient approach when both formats are needed, as it
 * only iterates through the database once.
 *
 * @param projectId - Project ID
 * @param archive - Archiver instance to append to
 * @param geojsonFilename - Filename for GeoJSON (e.g., 'spatial/export.geojson')
 * @param kmlFilename - Filename for KML (e.g., 'spatial/export.kml')
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
  const geojsonStats: SpatialAppendStats = {
    featureCount: 0,
    filename: geojsonFilename,
    hasSpatialFields: false,
  };

  const kmlStats: SpatialAppendStats = {
    featureCount: 0,
    filename: kmlFilename,
    hasSpatialFields: false,
  };

  // Get the database and UI spec
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  // Check for spatial fields
  const hasSpatialFields = Array.from(Object.keys(viewFieldsMap)).some(
    viewsetID => viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
  );

  geojsonStats.hasSpatialFields = hasSpatialFields;
  kmlStats.hasSpatialFields = hasSpatialFields;

  if (!hasSpatialFields) {
    return {geojson: geojsonStats, kml: kmlStats};
  }

  // Create PassThrough streams for both formats
  const geojsonStream = new PassThrough();
  const kmlStream = new PassThrough();

  archive.append(geojsonStream, {name: geojsonFilename});
  archive.append(kmlStream, {name: kmlFilename});

  // Track filenames
  const filenames: string[] = [];

  // Write headers
  geojsonStream.write('{"type":"FeatureCollection","features":[');
  kmlStream.write('<?xml version="1.0" encoding="UTF-8"?>');
  kmlStream.write('<kml xmlns="http://www.opengis.net/kml/2.2">');
  kmlStream.write('<Document>');

  let isFirstGeoJSONFeature = true;

  // Single iteration through ALL records
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    includeAttachments: false,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const hrid = record.hrid || record.record_id;
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = {
          ...baseProperties,
          geometry_source_view_id: geom.geometrySource.viewId,
          geometry_source_viewset_id: geom.geometrySource.viewsetId,
          geometry_source_field_id: geom.geometrySource.fieldId,
          geometry_source_type: geom.geometrySource.type,
        };

        // Write GeoJSON feature
        const geojsonOutput = {
          type: geom.type,
          geometry: geom.geometry,
          properties,
        };
        geojsonStream.write(
          `${isFirstGeoJSONFeature ? '' : ','}${JSON.stringify(geojsonOutput)}`
        );
        isFirstGeoJSONFeature = false;
        geojsonStats.featureCount++;

        // Write KML placemark
        try {
          const name = escapeXml(hrid);
          const geometryKML = convertGeometryToKML(geom.geometry);
          const extendedData = buildExtendedData(properties);

          kmlStream.write('<Placemark>');
          kmlStream.write(`<name>${name}</name>`);
          kmlStream.write(extendedData);
          kmlStream.write(geometryKML);
          kmlStream.write('</Placemark>');
          kmlStats.featureCount++;
        } catch (e) {
          console.error(
            `Error converting geometry to KML for record ${record.record_id}: ${e}`
          );
        }
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // Close both formats
  geojsonStream.write(']}');
  geojsonStream.end();

  kmlStream.write('</Document>');
  kmlStream.write('</kml>');
  kmlStream.end();

  // Wait for both streams to finish
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      geojsonStream.on('finish', resolve);
      geojsonStream.on('error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      kmlStream.on('finish', resolve);
      kmlStream.on('error', reject);
    }),
  ]);

  return {geojson: geojsonStats, kml: kmlStats};
};

/**
 * Stream the records in a notebook as a GeoJSON file (single pass)
 */
export const streamNotebookRecordsAsGeoJSON = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
) => {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  if (
    !Array.from(Object.keys(viewFieldsMap)).some(viewsetID =>
      viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
    )
  ) {
    res.end();
    throw new Error(
      'No spatial fields in any view, cannot produce a GeoJSON export!'
    );
  }

  const filenames: string[] = [];
  res.write('{"type":"FeatureCollection","features":[');
  let isFirstFeature = true;

  // Single iteration through ALL records
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    includeAttachments: false,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const output = {
          type: geom.type,
          geometry: geom.geometry,
          properties: {
            ...baseProperties,
            geometry_source_view_id: geom.geometrySource.viewId,
            geometry_source_viewset_id: geom.geometrySource.viewsetId,
            geometry_source_field_id: geom.geometrySource.fieldId,
            geometry_source_type: geom.geometrySource.type,
          },
        };

        res.write(`${isFirstFeature ? '' : ','}${JSON.stringify(output)}`);
        isFirstFeature = false;
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  res.write(']}');
  res.end();
};

/**
 * Stream the records in a notebook as a KML file (single pass)
 */
export const streamNotebookRecordsAsKML = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
) => {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  if (
    !Array.from(Object.keys(viewFieldsMap)).some(viewsetID =>
      viewFieldsMap[viewsetID].some(fSummary => fSummary.isSpatial)
    )
  ) {
    res.end();
    throw new Error(
      'No spatial fields in any view, cannot produce a KML export!'
    );
  }

  const filenames: string[] = [];

  res.write('<?xml version="1.0" encoding="UTF-8"?>');
  res.write('<kml xmlns="http://www.opengis.net/kml/2.2">');
  res.write('<Document>');

  // Single iteration through ALL records
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    includeAttachments: false,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const hrid = record.hrid || record.record_id;
      const {baseProperties, geometries} = processRecordForSpatial(
        record,
        viewFieldsMap,
        filenames
      );

      for (const geom of geometries) {
        const properties = {
          ...baseProperties,
          geometry_source_view_id: geom.geometrySource.viewId,
          geometry_source_viewset_id: geom.geometrySource.viewsetId,
          geometry_source_field_id: geom.geometrySource.fieldId,
          geometry_source_type: geom.geometrySource.type,
        };

        try {
          const name = escapeXml(hrid);
          const geometryKML = convertGeometryToKML(geom.geometry);
          const extendedData = buildExtendedData(properties);

          res.write('<Placemark>');
          res.write(`<name>${name}</name>`);
          res.write(extendedData);
          res.write(geometryKML);
          res.write('</Placemark>');
        } catch (e) {
          console.error(
            `Error converting geometry to KML for record ${record.record_id}: ${e}`
          );
        }
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  res.write('</Document>');
  res.write('</kml>');
  res.end();
};

// ============================================================================
// KML Helper Functions
// ============================================================================

/**
 * Escape XML special characters
 */
const escapeXml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Convert GeoJSON geometry to KML geometry
 */
const convertGeometryToKML = (geometry: any): string => {
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

  switch (type) {
    case 'Point':
      return `<Point><coordinates>${formatCoords(coords)}</coordinates></Point>`;
    case 'LineString':
      return `<LineString><coordinates>${formatCoords(coords)}</coordinates></LineString>`;
    case 'Polygon': {
      const outerRing = `<outerBoundaryIs><LinearRing><coordinates>${formatCoords(coords[0])}</coordinates></LinearRing></outerBoundaryIs>`;
      const innerRings = coords
        .slice(1)
        .map(
          (ring: any) =>
            `<innerBoundaryIs><LinearRing><coordinates>${formatCoords(ring)}</coordinates></LinearRing></innerBoundaryIs>`
        )
        .join('');
      return `<Polygon>${outerRing}${innerRings}</Polygon>`;
    }
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
        .map((polyCoords: any) => {
          const outer = `<outerBoundaryIs><LinearRing><coordinates>${formatCoords(polyCoords[0])}</coordinates></LinearRing></outerBoundaryIs>`;
          const inner = polyCoords
            .slice(1)
            .map(
              (ring: any) =>
                `<innerBoundaryIs><LinearRing><coordinates>${formatCoords(ring)}</coordinates></LinearRing></innerBoundaryIs>`
            )
            .join('');
          return `<Polygon>${outer}${inner}</Polygon>`;
        })
        .join('')}</MultiGeometry>`;
    default:
      throw new Error(`Unsupported geometry type: ${type}`);
  }
};

/**
 * Build ExtendedData section with properties
 */
const buildExtendedData = (properties: Record<string, any>): string => {
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
};
