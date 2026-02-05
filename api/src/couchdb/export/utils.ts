import {
  Annotations,
  FAIMSAttachmentReference,
  FieldSummary,
} from '@faims3/data-model';
import {generateFilenameForAttachment} from './attachmentExport';

/**
 * TODO it would be better to merge the header generation and value formatting
 * logic together - currently some parts are encoded twice in two different
 * ways.
 *
 *
 * generate a suitable value for the CSV export from a field value.  Serialise
 * filenames, gps coordinates, etc.
 */
export const csvFormatValue = (
  fieldName: string,
  fieldType: string,
  value: any,
  hrid: string,
  filenames: string[],
  viewsetId: string
) => {
  const result: {[key: string]: any} = {};
  if (fieldType === 'faims-attachment::Files') {
    if (value instanceof Array) {
      if (value.length === 0) {
        result[fieldName] = '';
        return result;
      }
      const valueList = (value as FAIMSAttachmentReference[])
        .filter(f => !!f.file_type)
        .map((fInfo: FAIMSAttachmentReference) => {
          const filename = generateFilenameForAttachment({
            fieldId: fieldName,
            hrid,
            viewID: viewsetId,
            // Pass in the file type
            fileMimeType: fInfo.file_type,
            filenames,
          });
          filenames.push(filename);
          return filename;
        });
      result[fieldName] = valueList.join(';');
    } else {
      result[fieldName] = value;
    }
    return result;
  }

  // gps locations
  if (fieldType === 'faims-pos::Location') {
    if (
      value instanceof Object &&
      'geometry' in value &&
      value.geometry.coordinates.length === 2
    ) {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = value.geometry.coordinates[1];
      result[fieldName + '_longitude'] = value.geometry.coordinates[0];
      result[fieldName + '_accuracy'] = value.properties.accuracy || '';
    } else {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = '';
      result[fieldName + '_longitude'] = '';
      result[fieldName + '_accuracy'] = '';
    }
    return result;
  }

  if (fieldType === 'faims-core::JSON') {
    // map location, if it's a point we can pull out lat/long
    if (
      value instanceof Object &&
      'features' in value &&
      value.features.length > 0 &&
      value.features[0]?.geometry?.type === 'Point' &&
      value.features[0].geometry.coordinates.length === 2
    ) {
      result[fieldName] = value;
      result[fieldName + '_latitude'] =
        value.features[0].geometry.coordinates[1];
      result[fieldName + '_longitude'] =
        value.features[0].geometry.coordinates[0];
      return result;
    } else {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = '';
      result[fieldName + '_longitude'] = '';
    }
  }

  if (fieldType === 'faims-core::Relationship') {
    if (value instanceof Array) {
      result[fieldName] = value
        .map((v: any) => {
          const relation_name = v.relation_type_vocabPair
            ? v.relation_type_vocabPair[0]
            : 'unknown relation';
          return `${relation_name}/${v.record_id}`;
        })
        .join(';');
    } else {
      result[fieldName] = value;
    }
    return result;
  }

  // default to just the value
  result[fieldName] = value;
  return result;
};

/**
 * Convert annotations on a field to a format suitable for CSV export
 */
export const csvFormatAnnotation = (
  field: FieldSummary,
  {annotation, uncertainty}: Annotations
) => {
  const result: {[key: string]: any} = {};
  if (field.annotation !== '')
    result[field.name + '_' + field.annotation] = annotation;
  if (field.uncertainty !== '')
    result[field.name + '_' + field.uncertainty] = uncertainty
      ? 'true'
      : 'false';
  return result;
};

/**
 * Format the data for a single record for CSV export
 *
 * @returns a map of column headings to values
 */
export const convertDataForOutput = (
  fields: FieldSummary[],
  data: any,
  annotations: {[name: string]: Annotations},
  hrid: string,
  filenames: string[],
  viewsetId: string
) => {
  let result: {[key: string]: any} = {};
  fields.forEach((field: any) => {
    if (field.name in data) {
      const formattedValue = csvFormatValue(
        field.name,
        field.type,
        data[field.name],
        hrid,
        filenames,
        viewsetId
      );
      const formattedAnnotation = csvFormatAnnotation(
        field,
        annotations[field.name] || {}
      );
      result = {...result, ...formattedValue, ...formattedAnnotation};
    }
  });
  return result;
};
