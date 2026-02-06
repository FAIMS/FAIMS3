import {
  Annotations,
  FAIMSAttachmentReference,
  FieldSummary,
} from '@faims3/data-model';
import {generateFilenameForAttachment} from './attachmentExport';

/**
 * Path component length limits.
 *
 * ZIP files support paths up to 65535 bytes, but many tools have issues with
 * paths > 255 chars. We use conservative limits per component:
 * - viewID: 30 chars (directory name)
 * - fieldId: 30 chars (subdirectory name)
 * - hrid (filename base): 40 chars
 * - csv filename: 40
 *
 * With slashes, extension, and collision suffix, max path is ~175 chars.
 * This leaves room for pathPrefix in full exports.
 */
export const MAX_VIEW_ID_LENGTH = 30;
export const MAX_FIELD_ID_LENGTH = 30;
export const MAX_HRID_LENGTH = 40;
export const MAX_CSV_FILENAME_LENGTH = 40;

/**
 * Length of the hash suffix used when truncating long identifiers.
 */
export const HASH_SUFFIX_LENGTH = 6;

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

/**
 * Simple deterministic hash function for strings.
 * Returns a hex string of the specified length.
 *
 * Uses a variant of djb2 hash algorithm which is fast and has good distribution.
 * This is NOT cryptographic - it's just for generating unique suffixes.
 */
export function simpleHash(str: string, length: number): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    // Keep it as a 32-bit integer
    hash = hash >>> 0;
  }
  // Convert to hex and pad/truncate to desired length
  return hash.toString(16).padStart(length, '0').slice(0, length);
}

/**
 * Truncates a string to a maximum length while preserving uniqueness.
 *
 * If the string is within the limit, returns it unchanged.
 * If truncation is needed, keeps the start of the string and appends a
 * deterministic hash of the full string, separated by underscore.
 *
 * Example:
 *   truncateWithHash("short", 40) => "short"
 *   truncateWithHash("very_long_identifier_that_exceeds_limit", 20)
 *     => "very_long_i_a1b2c3d4"
 *
 * The hash ensures that different long strings produce different results,
 * even if they share the same prefix.
 *
 * @param str - The string to potentially truncate
 * @param maxLength - Maximum allowed length for the result
 * @returns A string guaranteed to be <= maxLength, preserving uniqueness
 */
export function truncateWithHash(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }

  // Reserve space for: underscore + hash suffix
  const prefixLength = maxLength - 1 - HASH_SUFFIX_LENGTH;

  if (prefixLength < 1) {
    // Edge case: maxLength is too small to fit prefix + hash
    // Just return the hash (this shouldn't happen with our constants)
    return simpleHash(str, maxLength);
  }

  const prefix = str.slice(0, prefixLength);
  const hash = simpleHash(str, HASH_SUFFIX_LENGTH);

  return `${prefix}_${hash}`;
}

/**
 * Slugify base function - takes string and returns filename safe version
 * @param v The input string to slugify
 * @returns Cleaned / filename safe
 */
export function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Helper to create a slugified filename from a label.
 *
 * Uses deterministic hash-based truncation to ensure that long labels
 * produce unique filenames even if they share the same prefix.
 */
export const slugifyLabel = (label: string, maxLength = 50): string => {
  const slugified = slugify(label);

  if (slugified.length <= maxLength) {
    return slugified;
  }

  // Reserve space for: underscore + hash suffix
  const prefixLength = maxLength - 1 - HASH_SUFFIX_LENGTH;
  const prefix = slugified.slice(0, prefixLength);
  const hash = simpleHash(slugified, HASH_SUFFIX_LENGTH);

  return `${prefix}_${hash}`;
};

/**
 * Helper to ensure unique filenames in a list
 */
export const ensureUniqueFilename = (
  baseFilename: string,
  extension: string,
  existingFilenames: string[]
): string => {
  let filename = `${baseFilename}.${extension}`;
  let counter = 1;

  while (existingFilenames.includes(filename)) {
    filename = `${baseFilename}_${counter}.${extension}`;
    counter++;
  }

  return filename;
};
