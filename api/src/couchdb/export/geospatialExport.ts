/**
 * Description:
 *    Export geospatial data from FAIMS in various formats
 */

import {
  ProjectID,
  buildViewsetFieldSummaries,
  notebookRecordIterator,
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
 * Appends a GeoJSON file to an existing archive.
 *
 * Uses a PassThrough stream to pipe GeoJSON output directly
 * into the archiver without buffering in memory.
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

  // Get the database
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

  let isFirstRecord = true;

  for (const viewID of Object.keys(viewFieldsMap)) {
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      if (record) {
        const hrid = record.hrid || record.record_id;

        const baseJsonData: Record<string, any> = {
          hrid,
          record_id: record.record_id,
          revision_id: record.revision_id,
          type: record.type,
          created_by: record.created_by,
          created_time: record.created.toISOString(),
          updated_by: record.updated_by,
          updated_time: record.updated.toISOString(),
        };

        const data = record.data;

        const geometric: {
          type: string;
          geometry: string;
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        viewFieldsMap[viewID].forEach(fieldInfo => {
          if (Object.keys(data).includes(fieldInfo.name)) {
            const fieldData = data[fieldInfo.name];

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
                if (
                  feature &&
                  feature.geometry &&
                  feature.geometry.coordinates
                ) {
                  geometric.push({
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

            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            for (const kv of Object.entries(convertedData)) {
              baseJsonData[kv[0]] = kv[1];
            }
          }
        });

        for (const geom of geometric) {
          const output = {
            type: geom.type,
            geometry: geom.geometry,
            properties: {
              ...baseJsonData,
              geometry_source_view_id: geom.geometrySource.viewId,
              geometry_source_viewset_id: geom.geometrySource.viewsetId,
              geometry_source_field_id: geom.geometrySource.fieldId,
              geometry_source_type: geom.geometrySource.type,
            },
          };

          geojsonStream.write(
            `${isFirstRecord ? '' : ','}${JSON.stringify(output)}`
          );
          isFirstRecord = false;
          stats.featureCount++;
        }
      }

      const next = await iterator.next();
      record = next.record;
      done = next.done;
    }
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
 * Appends a KML file to an existing archive.
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

  // Get the database
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

  for (const viewID of Object.keys(viewFieldsMap)) {
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      if (record) {
        const hrid = record.hrid || record.record_id;

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

        const data = record.data;

        const geometric: {
          type: string;
          geometry: any;
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        viewFieldsMap[viewID].forEach(fieldInfo => {
          if (Object.keys(data).includes(fieldInfo.name)) {
            const fieldData = data[fieldInfo.name];

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
                if (
                  feature &&
                  feature.geometry &&
                  feature.geometry.coordinates
                ) {
                  geometric.push({
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
                    `Encountered geometry which appeared valid but had no geometry or coordinates fields.`
                  );
                }
              } catch (e) {
                console.error(
                  `Issue while converting geometry ${e}. Record: ${record?.record_id}.`
                );
              }
            }

            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            for (const kv of Object.entries(convertedData)) {
              baseProperties[kv[0]] = kv[1];
            }
          }
        });

        for (const geom of geometric) {
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
 * Stream the records in a notebook as a GeoJSON file
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
  let isFirstRecord = true;

  for (const viewID of Object.keys(viewFieldsMap)) {
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      if (record) {
        const hrid = record.hrid || record.record_id;

        const baseJsonData: Record<string, any> = {
          hrid,
          record_id: record.record_id,
          revision_id: record.revision_id,
          type: record.type,
          created_by: record.created_by,
          created_time: record.created.toISOString(),
          updated_by: record.updated_by,
          updated_time: record.updated.toISOString(),
        };

        const data = record.data;

        const geometric: {
          type: string;
          geometry: string;
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        viewFieldsMap[viewID].forEach(fieldInfo => {
          if (Object.keys(data).includes(fieldInfo.name)) {
            const fieldData = data[fieldInfo.name];

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
                if (
                  feature &&
                  feature.geometry &&
                  feature.geometry.coordinates
                ) {
                  geometric.push({
                    type: feature.type,
                    geometry: feature.geometry,
                    geometrySource: {
                      fieldId: fieldInfo.name,
                      viewsetId: fieldInfo.viewsetId,
                      type: fieldInfo.type,
                      viewId: fieldInfo.viewId,
                    },
                  });
                }
              } catch (e) {
                console.error(`issue while converting geometry ${e}`);
              }
            }

            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            for (const kv of Object.entries(convertedData)) {
              baseJsonData[kv[0]] = kv[1];
            }
          }
        });

        for (const geom of geometric) {
          const output = {
            type: geom.type,
            geometry: geom.geometry,
            properties: {
              ...baseJsonData,
              geometry_source_view_id: geom.geometrySource.viewId,
              geometry_source_viewset_id: geom.geometrySource.viewsetId,
              geometry_source_field_id: geom.geometrySource.fieldId,
              geometry_source_type: geom.geometrySource.type,
            },
          };

          res.write(`${isFirstRecord ? '' : ','}${JSON.stringify(output)}`);
          isFirstRecord = false;
        }
      }

      const next = await iterator.next();
      record = next.record;
      done = next.done;
    }
  }

  res.write(']}');
  res.end();
};

/**
 * Stream the records in a notebook as a KML file
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

  for (const viewID of Object.keys(viewFieldsMap)) {
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      if (record) {
        const hrid = record.hrid || record.record_id;

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

        const data = record.data;

        const geometric: {
          type: string;
          geometry: any;
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        viewFieldsMap[viewID].forEach(fieldInfo => {
          if (Object.keys(data).includes(fieldInfo.name)) {
            const fieldData = data[fieldInfo.name];

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
                if (
                  feature &&
                  feature.geometry &&
                  feature.geometry.coordinates
                ) {
                  geometric.push({
                    type: feature.type,
                    geometry: feature.geometry,
                    geometrySource: {
                      fieldId: fieldInfo.name,
                      viewsetId: fieldInfo.viewsetId,
                      type: fieldInfo.type,
                      viewId: fieldInfo.viewId,
                    },
                  });
                }
              } catch (e) {
                console.error(`issue while converting geometry ${e}`);
              }
            }

            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            for (const kv of Object.entries(convertedData)) {
              baseProperties[kv[0]] = kv[1];
            }
          }
        });

        for (const geom of geometric) {
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
