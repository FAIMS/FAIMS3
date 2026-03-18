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

/** Build the full component key used for serialization lookup (namespace::name). */
function getComponentKey(namespace: string, name: string): string {
  return namespace ? `${namespace}::${name}` : name;
}

/** Component keys that produce attachment/file serialization (array of filenames). */
const ATTACHMENT_COMPONENTS = new Set([
  'faims-custom::TakePhoto',
  'faims-custom::FileUploader',
]);

/** Component key for single-point GPS location (lat/long/accuracy). */
const LOCATION_COMPONENT = 'faims-custom::TakePoint';

/** Component key for structured address (display_name, address pieces, manual). */
const ADDRESS_COMPONENT = 'faims-custom::AddressField';

/** Component key for map/GeoJSON FeatureCollection (lat/long from first point). */
const MAP_COMPONENT = 'mapping-plugin::MapFormField';

/** Component key for relationship list (type/id joined with ;). */
const RELATIONSHIP_COMPONENT = 'faims-custom::RelatedRecordSelector';

/**
 * generate a suitable value for the CSV export from a field value.  Serialise
 * filenames, gps coordinates, etc.
 *
 * Serialization is determined by the field's component (namespace + name), not
 * by the return type.
 *
 * TODO it would be better to merge the header generation and value formatting
 * logic together - currently some parts are encoded twice in two different
 * ways.
 *
 * @param params
 *   - componentNamespace: The component namespace from the UI spec.
 *   - componentName: The component name from the UI spec.
 *   - fieldName: The column/field name.
 *   - value: The raw value to serialize.
 *   - hrid: Human-readable ID (for attachment filenames, etc).
 *   - filenames: List to which CSV attachment filenames are appended.
 *   - viewsetId: The current view set ID for this export context.
 *
 * @returns Object mapping column names to their serialized values.
 */
export const csvFormatValue = ({
  componentNamespace,
  componentName,
  fieldName,
  value,
  hrid,
  filenames,
  viewsetId,
}: {
  componentNamespace: string;
  componentName: string;
  fieldName: string;
  value: any;
  hrid: string;
  filenames: string[];
  viewsetId: string;
}) => {
  const result: {[key: string]: any} = {};
  const componentKey = getComponentKey(componentNamespace, componentName);

  // Handle attachment/file field serialization.
  if (ATTACHMENT_COMPONENTS.has(componentKey)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        result[fieldName] = '';
        return result;
      }
      // Only serialize valid files with a file_type.
      const valueList = value
        .filter((f: FAIMSAttachmentReference) => !!f.file_type)
        .map((fInfo: FAIMSAttachmentReference) => {
          // Generate a CSV-safe filename for this attachment and track it.
          const filename = generateFilenameForAttachment({
            fieldId: fieldName,
            hrid,
            viewID: viewsetId,
            fileMimeType: fInfo.file_type,
            filenames,
          });
          filenames.push(filename);
          return filename;
        });
      result[fieldName] = valueList.join(';');
    } else {
      // If somehow not an array, just emit whatever is there.
      result[fieldName] = value;
    }
    return result;
  }

  // Handle GPS/location fields.
  if (componentKey === LOCATION_COMPONENT) {
    if (
      value instanceof Object &&
      value.geometry &&
      Array.isArray(value.geometry.coordinates) &&
      value.geometry.coordinates.length === 2
    ) {
      // Emit lat/long (GeoJSON is lng,lat order).
      result[fieldName] = value;
      result[`${fieldName}_latitude`] = value.geometry.coordinates[1];
      result[`${fieldName}_longitude`] = value.geometry.coordinates[0];
      // Accuracy, if available.
      result[`${fieldName}_accuracy`] =
        value.properties && value.properties.accuracy
          ? value.properties.accuracy
          : '';
    } else {
      // Default to blank on error/malformed shape.
      result[fieldName] = value;
      result[`${fieldName}_latitude`] = '';
      result[`${fieldName}_longitude`] = '';
      result[`${fieldName}_accuracy`] = '';
    }
    return result;
  }

  // Handle address field (structured address with display_name, address pieces).
  if (componentKey === ADDRESS_COMPONENT) {
    if (value instanceof Object && 'display_name' in value) {
      // Prefer display_name, fallback to manuallyEnteredAddress, else blank.
      const display =
        (typeof value.display_name === 'string' && value.display_name) ||
        (typeof value.manuallyEnteredAddress === 'string' &&
          value.manuallyEnteredAddress) ||
        '';

      result[fieldName] = display;

      // Always emit every address piece, even if empty.
      const addr = value.address || {};
      result[`${fieldName}_house_number`] = addr.house_number ?? '';
      result[`${fieldName}_road`] = addr.road ?? '';
      result[`${fieldName}_suburb`] = addr.suburb ?? '';
      result[`${fieldName}_town`] = addr.town ?? '';
      result[`${fieldName}_state`] = addr.state ?? '';
      result[`${fieldName}_postcode`] = addr.postcode ?? '';
      result[`${fieldName}_country`] = addr.country ?? '';
      result[`${fieldName}_country_code`] = addr.country_code ?? '';

      // Emit the manually entered address verbatim if present.
      result[`${fieldName}_manual`] =
        typeof value.manuallyEnteredAddress === 'string'
          ? value.manuallyEnteredAddress
          : '';

      return result;
    }
  }

  // Handle map/GeoJSON field (FeatureCollection, emit lat/long from first Point).
  if (componentKey === MAP_COMPONENT) {
    if (
      value instanceof Object &&
      Array.isArray(value.features) &&
      value.features.length > 0 &&
      value.features[0]?.geometry?.type === 'Point' &&
      Array.isArray(value.features[0].geometry.coordinates) &&
      value.features[0].geometry.coordinates.length === 2
    ) {
      result[fieldName] = value;
      result[`${fieldName}_latitude`] =
        value.features[0].geometry.coordinates[1];
      result[`${fieldName}_longitude`] =
        value.features[0].geometry.coordinates[0];
      return result;
    } else {
      result[fieldName] = value;
      result[`${fieldName}_latitude`] = '';
      result[`${fieldName}_longitude`] = '';
    }
    return result;
  }

  // Handle relationship fields (array of relations, as "type/id" joined with ;)
  if (componentKey === RELATIONSHIP_COMPONENT) {
    if (Array.isArray(value)) {
      result[fieldName] = value
        .map((v: any) => {
          const relation_name = Array.isArray(v.relation_type_vocabPair)
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

  // Default: emit value verbatim.
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
      const formattedValue = csvFormatValue({
        componentNamespace: field.componentNamespace,
        componentName: field.componentName,
        fieldName: field.name,
        value: data[field.name],
        hrid,
        filenames,
        viewsetId,
      });
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
