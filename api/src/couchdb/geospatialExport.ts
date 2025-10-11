/**
 * Description:
 *    Export geospatial data from FAIMS in various formats
 */

import {
  ProjectID,
  buildViewsetFieldSummaries,
  notebookRecordIterator,
} from '@faims3/data-model';
import {getDataDb} from '.';
import {convertDataForOutput, getProjectUIModel} from './notebooks';

/**
 * Stream the records in a notebook as a GeoJSON file
 *
 * @param projectId Project ID
 * @param res writeable stream
 */
export const streamNotebookRecordsAsGeoJSON = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
) => {
  // Get the database
  const dataDb = await getDataDb(projectId);

  // get the UI spec
  const uiSpecification = await getProjectUIModel(projectId);

  // get a mapping of viewset ID -> field summaries
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  // First do validation to ensure spatial elements are present
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

  // Everything appears to be in order, so we...

  // a) track filenames
  const filenames: string[] = [];

  // b) write out the header
  res.write('{"type":"FeatureCollection","features":[');

  // c) stream individual features in the GeoJSON feature collection, one
  // viewset at a time

  // For the first one, don't prepend a comma
  let isFirstRecord = true;

  for (const viewID of Object.keys(viewFieldsMap)) {
    // This is a record iterator which returns an efficient iteration through the
    // records each containing a data object with a hydrated {key, value} dataset
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      // For each valid record (row)
      if (record) {
        // Get the HRID
        const hrid = record.hrid || record.record_id;

        // Setup the base JSON data
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

        // extract data out
        const data = record.data;

        // As we go, track the encountered geometric entries
        const geometric: {
          // The geoJSON geometry type (feature,point,polygon etc)
          type: string;
          // The geometry string
          geometry: string;
          // We also want to track the geometry source in the properties
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        // Then iterate through the fields, and extra data if available
        viewFieldsMap[viewID].forEach(fieldInfo => {
          // Does the record contain a corresponding entry?
          if (Object.keys(data).includes(fieldInfo.name)) {
            // get it out
            const fieldData = data[fieldInfo.name];

            // Is this a geospatial field? If so - just mark our geometric
            // objects to add and proceed
            if (
              // Is it spatial
              fieldInfo.isSpatial &&
              // Does it seem to be valid/defined?
              fieldData !== undefined &&
              fieldData !== null &&
              // Empty string check
              fieldData !== '' &&
              // General truthy check
              !!fieldInfo
            ) {
              // If the record is spatial its data is typically GeoJSON - let's
              // try figure that out
              try {
                // get the first feature
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
                  // We handle this specially by promoting above
                  geometric.push({
                    type: feature.type,
                    geometry: feature.geometry,
                    // where did this geometry come from?
                    geometrySource: {
                      fieldId: fieldInfo.name,
                      viewsetId: fieldInfo.viewsetId,
                      type: fieldInfo.type,
                      viewId: fieldInfo.viewId,
                    },
                  });
                } else {
                  console.warn(
                    `Encountered geometry which appeared on the surface to be valid but had no geometry or coordinates fields. Field data: ${JSON.stringify(fieldData)}. Feature: ${JSON.stringify(feature)}.`
                  );
                }
              } catch (e) {
                // Just log this error - nothing specifically needs to happen -
                // we should be able to proceed
                console.error(
                  `issue while converting geometry ${e}. Field data: ${JSON.stringify(fieldData)}. Record: ${record?.record_id}. Field info: ${JSON.stringify(fieldInfo)}.`
                );
              }
            }

            // Regardless we append typical data fields to retain consistency
            // with existing encoding approaches
            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            // this is a possible set of things to append - append them
            for (const kv of Object.entries(convertedData)) {
              baseJsonData[kv[0]] = kv[1];
            }
          }
        });

        // We've gone through all fields and either created properties or
        // geometries, for each geometry, append the properties, then add to
        // GeoJSON
        for (const geom of geometric) {
          // output is {type, geometry, properties}
          const output = {
            type: geom.type,
            geometry: geom.geometry,
            properties: {
              ...baseJsonData,
              // Here we append additional information about the geometry source
              // so that if there are more than one geometry per
              geometry_source_view_id: geom.geometrySource.viewId,
              geometry_source_viewset_id: geom.geometrySource.viewsetId,
              geometry_source_field_id: geom.geometrySource.fieldId,
              geometry_source_type: geom.geometrySource.type,
            },
          };

          // And write this out (prepending a comma if NOT first record)
          res.write(`${isFirstRecord ? '' : ','}${JSON.stringify(output)}`);

          // No longer first record
          isFirstRecord = false;
        }
      }

      // Go to next record (if available)
      const next = await iterator.next();
      record = next.record;
      done = next.done;
    }
  }

  // Close up shop
  res.write(']}');
  res.end();
};

/**
 * Helper function to escape XML special characters
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
 * Helper function to convert GeoJSON geometry to KML geometry
 */
const convertGeometryToKML = (geometry: any): string => {
  const type = geometry.type;
  const coords = geometry.coordinates;
  // Helper to format coordinate pairs for KML (lon,lat,alt)
  const formatCoords = (coordArray: any): string => {
    if (typeof coordArray[0] === 'number') {
      // Single coordinate pair
      return coordArray.length === 3
        ? `${coordArray[0]},${coordArray[1]},${coordArray[2]}`
        : `${coordArray[0]},${coordArray[1]},0`;
    }
    // Array of coordinates
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
 * Helper function to build ExtendedData section with properties
 */
const buildExtendedData = (properties: Record<string, any>): string => {
  const dataElements = Object.entries(properties)
    .map(([key, value]) => {
      const displayName = escapeXml(key);
      // Handle different value types properly
      let displayValue: string;
      if (value === null || value === undefined) {
        displayValue = '';
      } else if (typeof value === 'object') {
        // Serialize objects as JSON instead of [object Object]
        displayValue = escapeXml(JSON.stringify(value));
      } else {
        displayValue = escapeXml(String(value));
      }
      return `<Data name="${displayName}"><value>${displayValue}</value></Data>`;
    })
    .join('');

  return `<ExtendedData>${dataElements}</ExtendedData>`;
};

/**
 * Stream the records in a notebook as a KML file
 *
 * @param projectId Project ID
 * @param res writeable stream
 */
export const streamNotebookRecordsAsKML = async (
  projectId: ProjectID,
  res: NodeJS.WritableStream
) => {
  // Get the database
  const dataDb = await getDataDb(projectId);

  // get the UI spec
  const uiSpecification = await getProjectUIModel(projectId);

  // get a mapping of viewset ID -> field summaries
  const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification});

  // First do validation to ensure spatial elements are present
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

  // Everything appears to be in order, so we...

  // a) track filenames
  const filenames: string[] = [];

  // b) write out the KML header
  res.write('<?xml version="1.0" encoding="UTF-8"?>');
  res.write('<kml xmlns="http://www.opengis.net/kml/2.2">');
  res.write('<Document>');

  // c) stream individual placemarks, one viewset at a time

  for (const viewID of Object.keys(viewFieldsMap)) {
    // This is a record iterator which returns an efficient iteration through the
    // records each containing a data object with a hydrated {key, value} dataset
    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      uiSpecification,
      viewID,
    });

    let {record, done} = await iterator.next();
    while (!done) {
      // For each valid record (row)
      if (record) {
        // Get the HRID
        const hrid = record.hrid || record.record_id;

        // Setup the base properties data
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

        // extract data out
        const data = record.data;

        // As we go, track the encountered geometric entries
        const geometric: {
          // The geoJSON geometry type (feature,point,polygon etc)
          type: string;
          // The geometry object
          geometry: any;
          // We also want to track the geometry source in the properties
          geometrySource: {
            viewsetId: string;
            viewId: string;
            fieldId: string;
            type: string;
          };
        }[] = [];

        // Then iterate through the fields, and extract data if available
        viewFieldsMap[viewID].forEach(fieldInfo => {
          // Does the record contain a corresponding entry?
          if (Object.keys(data).includes(fieldInfo.name)) {
            // get it out
            const fieldData = data[fieldInfo.name];

            // Is this a geospatial field? If so - just mark our geometric
            // objects to add and proceed
            if (
              // Is it spatial
              fieldInfo.isSpatial &&
              // Does it seem to be valid/defined?
              fieldData !== undefined &&
              fieldData !== null &&
              // Empty string check
              fieldData !== '' &&
              // General truthy check
              !!fieldInfo
            ) {
              // If the record is spatial its data is typically GeoJSON - let's
              // try figure that out
              try {
                // get the first feature
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
                  // We handle this specially by promoting above
                  geometric.push({
                    type: feature.type,
                    geometry: feature.geometry,
                    // where did this geometry come from?
                    geometrySource: {
                      fieldId: fieldInfo.name,
                      viewsetId: fieldInfo.viewsetId,
                      type: fieldInfo.type,
                      viewId: fieldInfo.viewId,
                    },
                  });
                } else {
                  console.warn(
                    `Encountered geometry which appeared on the surface to be valid but had no geometry or coordinates fields. Field data: ${JSON.stringify(fieldData)}. Feature: ${JSON.stringify(feature)}.`
                  );
                }
              } catch (e) {
                // Just log this error - nothing specifically needs to happen -
                // we should be able to proceed
                console.error(
                  `issue while converting geometry ${e}. Field data: ${JSON.stringify(fieldData)}. Record: ${record?.record_id}. Field info: ${JSON.stringify(fieldInfo)}.`
                );
              }
            }

            // Regardless we append typical data fields to retain consistency
            // with existing encoding approaches
            const convertedData = convertDataForOutput(
              viewFieldsMap[viewID],
              data,
              record!.annotations,
              hrid,
              filenames,
              viewID
            );

            // this is a possible set of things to append - append them
            for (const kv of Object.entries(convertedData)) {
              baseProperties[kv[0]] = kv[1];
            }
          }
        });

        // We've gone through all fields and either created properties or
        // geometries, for each geometry, create a Placemark and add to KML
        for (const geom of geometric) {
          // Add geometry source information to properties
          const properties = {
            ...baseProperties,
            geometry_source_view_id: geom.geometrySource.viewId,
            geometry_source_viewset_id: geom.geometrySource.viewsetId,
            geometry_source_field_id: geom.geometrySource.fieldId,
            geometry_source_type: geom.geometrySource.type,
          };

          try {
            // Build the Placemark
            const name = escapeXml(hrid);
            const geometryKML = convertGeometryToKML(geom.geometry);
            const extendedData = buildExtendedData(properties);

            // Write the Placemark
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

      // Go to next record (if available)
      const next = await iterator.next();
      record = next.record;
      done = next.done;
    }
  }

  // Close up shop
  res.write('</Document>');
  res.write('</kml>');
  res.end();
};
