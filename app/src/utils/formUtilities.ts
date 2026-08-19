import {Record} from '@faims3/data-model';
import {RecordContext} from '../gui/components/record/types';

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

/**
 * Formats a timestamp into a date-time string in the format "DD/MM/YY H:MMam/pm"
 *
 * @param timestamp - Unix timestamp in milliseconds (e.g., from Date.now())
 * @returns Formatted date-time string or empty string if input is invalid
 *
 * @throws Never - Returns empty string for all error cases
 *
 * Handles the following edge cases:
 * - Invalid inputs (null, undefined, NaN, Infinity)
 * - String timestamps (converts to numbers)
 * - Invalid date objects
 * - Out of range values for date components
 */
export function formatTimestamp(
  timestamp: string | number | null | undefined,
  timezone: string | undefined = undefined
): string {
  if (timestamp === null || timestamp === undefined) {
    return '';
  }

  const timestampNum =
    typeof timestamp === 'string' ? Number(timestamp) : timestamp;

  if (isNaN(timestampNum) || !isFinite(timestampNum)) {
    return '';
  }

  try {
    const date = new Date(timestampNum);

    // If timezone is specified, convert to that timezone
    if (timezone) {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      };

      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(
        date
      );
      const dateParts = parts.reduce(
        (acc, part) => {
          acc[part.type] = part.value;
          return acc;
        },
        {} as {[key: string]: string}
      );

      const day = dateParts.day.padStart(2, '0');
      const month = dateParts.month.padStart(2, '0');
      const year = dateParts.year.slice(-2);

      let hours = parseInt(dateParts.hour);
      if (dateParts.dayPeriod === 'PM' && hours !== 12) hours += 12;
      if (dateParts.dayPeriod === 'AM' && hours === 12) hours = 0;

      hours = hours % 12 || 12;
      const minutes = dateParts.minute.padStart(2, '0');
      const ampm = dateParts.dayPeriod.toLowerCase();

      return `${day}-${month}-${year} ${hours}:${minutes}${ampm}`;
    }

    // Default behavior using local timezone
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';

    hours = hours % 12;
    hours = hours || 12;

    return `${day}-${month}-${year} ${hours}:${minutes}${ampm}`;
  } catch (error) {
    return '';
  }
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
