import {RecordContext} from '../gui/components/record/types';
import {formatTimestamp, Record} from '@faims3/data-model';

/**
 * Converts a record into record context used in the form
 * @param record
 * @returns The form context which can be injected
 */
export function getRecordContextFromRecord({
  record,
}: {
  record: Record;
}): RecordContext {
  return {
    // The author
    createdBy: record?.created_by,
    // The created time (epoch ms timestamp)
    createdTime: record?.created?.getTime(),
  };
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  return formatTimestamp(date.getTime());
}

/** Placeholder shown when a record value is missing or cannot be rendered. */
export const MISSING_DATA_PLACEHOLDER = '-';

/**
 * Converts record metadata field values to displayable strings.
 *
 * @param field - The field name to extract from the data
 * @param data - The data object containing the field
 * @returns A string representation of the field value, or a fallback value if
 *          the data is missing or cannot be converted
 */
export function getDisplayDataFromRecordMetadata({
  field,
  data,
}: {
  field: string;
  data: {[key: string]: any};
}): string {
  const fallback = MISSING_DATA_PLACEHOLDER;
  try {
    if (!data) return fallback;

    const value = data[field];

    if (value === undefined || value === null) return fallback;

    switch (typeof value) {
      case 'string':
        return value.trim() || fallback;
      case 'number':
        return Number.isFinite(value) ? value.toString() : fallback;
      case 'boolean':
        return value.toString();
      case 'object':
        if (Array.isArray(value)) {
          return value.filter(item => item !== null).join(', ') || fallback;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        try {
          const str = JSON.stringify(value);
          return str === '{}' ? fallback : str;
        } catch {
          return fallback;
        }
      default:
        return fallback;
    }
  } catch (error) {
    console.warn(`Error formatting field ${field}:`, error);
    return fallback;
  }
}
