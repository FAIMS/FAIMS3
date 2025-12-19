import {Record} from '@faims3/data-model';
import Mustache from 'mustache';
import {RecordContext} from '../gui/components/record/types';

/*
Patch mustache to not escape values.

This addresses JIRA BSS-714 where Observation/Point of Interest was being
rendered as "Observation&#x2F;Point of Interest"

This is generally a risky approach but safe enough in our use case provided the
output is never:

- Inserted into the DOM using .innerHTML
- Used as an HTML attribute value
- Evaluated as JavaScript
- Used in a <script> tag
- Used in a CSS value
- Used in a URL
*/
Mustache.escape = function (text: string) {
  return text;
};

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

/**
 * Converts field names to a more readable format by:
 * 1. Splitting CamelCase into separate words
 * 2. Replacing hyphens with spaces
 * 3. Trimming any resulting extra whitespace
 *
 * @param fieldName - The input field name to prettify
 * @returns A cleaned and formatted string
 */
export function prettifyFieldName(fieldName: string): string {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Split CamelCase by adding space between lower and upper case letters
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Handle consecutive capitals (e.g., APIResponse -> API Response)
    .replace(/([a-zA-Z])(\d+)/g, '$1 $2') // Split between letters and numbers
    .replace(/(\d+)([a-zA-Z])/g, '$1 $2') // Split between numbers and letters
    .replace(/-/g, ' ') // Replace all hyphens with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace
}
