import {
  getFieldToIdsMap,
  getHridFieldMap,
  ProjectUIModel,
  Record,
} from '@faims3/data-model';
import Mustache from 'mustache';
import {RecordContext} from '../gui/components/record/form';

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
 * Converts a record (real or draft) into record context used in the form
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

// TEMPLATE RENDERING
// ------------------

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

const TEMPLATED_STRING_FIELD_NAME = 'TemplatedStringField';
export type ValuesObject = {[fieldName: string]: any};

// What system variables can we inject
const CREATOR_NAME_ID = '_CREATOR_NAME';
const CREATED_TIME_ID = '_CREATED_TIME';

/**
 * Converts the RecordContext into an object mapping from key -> value for use
 * in template replacement
 * @param context
 * @returns The context values to inject
 */
function contextToTemplate(context: RecordContext): ValuesObject {
  const vals: ValuesObject = {};
  vals[CREATOR_NAME_ID] = context.createdBy ?? 'Unknown User';
  vals[CREATED_TIME_ID] = context.createdTime
    ? formatTimestamp(context.createdTime)
    : 'Unknown Time';
  return vals;
}

/**
 * Renders a mustache template into a string
 * @param template The template string
 * @param values The form values to use in replacmeent
 * @param context The record context
 * @param excludedFields Fields to exclude from replacement
 */
function renderTemplate({
  template,
  values,
  context,
  excludedFields,
}: {
  template: string;
  values: ValuesObject;
  context: RecordContext;
  excludedFields: string[];
}): string {
  // generate context vars from record context
  const contextVars = contextToTemplate(context);
  const filteredValues: ValuesObject = {};
  for (const [k, v] of Object.entries({...values, ...contextVars})) {
    if (!excludedFields.includes(k)) {
      // Filter out any excluded fields
      filteredValues[k] = v;
    }
  }

  // Render
  return Mustache.render(template, filteredValues);
}

/**
 * Given the existing values, ui spec and context, updates the values.
 * Recomputes derived template field properties.
 *
 * Filters out any template fields
 *
 * @param values
 * @param uiSpecification
 * @param context
 */
export function recomputeDerivedFields({
  values,
  uiSpecification,
  context,
}: {
  values: ValuesObject;
  uiSpecification: ProjectUIModel;
  context: RecordContext;
}): boolean {
  // compute fields to be updated
  const fieldsToBeUpdated: {template: string; fieldName: string}[] = [];
  const filterFields: string[] = [];

  for (const fieldName of Object.keys(uiSpecification.fields)) {
    // Get info about it
    const fieldDetails = uiSpecification.fields[fieldName];
    // We are looking for these fields "component-name": "TemplatedStringField"
    if (fieldDetails['component-name'] === TEMPLATED_STRING_FIELD_NAME) {
      // We should always filter out templated strings from template expansion
      filterFields.push(fieldName);

      // We found a templated field
      if (fieldName in values) {
        // check we have a template prop
        const template = fieldDetails['component-parameters']?.template;
        if (!template) {
          console.warn(
            'TemplatedStringField missing template prop - cannot render.'
          );
          continue;
        }

        if (typeof template !== 'string') {
          console.warn('TemplatedStringField template prop is not a string.');
          continue;
        }
        fieldsToBeUpdated.push({fieldName, template});
      }
    }
  }

  // notify if something changes
  let changeDetected = false;

  // For each field, recompute given broader context and then update
  for (const {fieldName, template} of fieldsToBeUpdated) {
    // Generate the updated value
    const rendered = renderTemplate({
      context,
      template,
      values,
      excludedFields: filterFields,
    });
    // Update the value if it's changed
    const previousFieldValue = values[fieldName];
    if (previousFieldValue !== rendered) {
      values[fieldName] = rendered;
      changeDetected = true;
    }
  }

  return changeDetected;
}

/**
 * Uses the UI specification to reverse engineer the viewset that the values are
 * a part of. Then tries to look for hridField or hrid prefix to determine the
 * ideal HRID. Returns the value, if present, or undefined.
 *
 * @param values The field values which is an object mapping field name -> value
 * @param uiSpecification The ui specification for this value set
 *
 * @returns The likely HRID - either the specified HRID from the hridField in
 * the ui spec, if present, then the hrid prefix field as a backup, undefined if
 * not available or the values are undefined
 */
export function getHridFromValuesAndSpec({
  values,
  uiSpecification,
}: {
  values: ValuesObject;
  uiSpecification: ProjectUIModel;
}): string | undefined {
  // Get necessary maps re: UI specification
  const fieldToIdMap = getFieldToIdsMap(uiSpecification);
  const viewsetToHridFieldMap = getHridFieldMap(uiSpecification);

  // Here we reverse engineer the correct hrid field to look for since we
  // need to know the viewset ID that a field pertains to in order to get
  // the correct hrid field name
  const fieldNames = Array.from(Object.keys(values ?? {})) ?? [];

  // try to find any field name which has a viewset in the ui spec!
  let relevantViewset = undefined;
  for (const fieldName of fieldNames) {
    relevantViewset = fieldToIdMap[fieldName]?.viewSetId;
    if (relevantViewset !== undefined) {
      break;
    }
  }

  // Here we have found a matching viewset, which is a good start
  if (relevantViewset) {
    // See if we have a matching ideal case
    const hridFieldName = viewsetToHridFieldMap[relevantViewset];
    if (hridFieldName && values[hridFieldName]) {
      return values[hridFieldName];
    }
  }

  // If there is no viewset which this corresponds to for ANY value, we really
  // are in a bad state - but let's still give it a shot using the old approach
  const possibleHRIDFields = Object.getOwnPropertyNames(values).filter(
    (f: string) => f.startsWith('hrid')
  );

  // Try to get any matching hrid field
  for (const fieldName of possibleHRIDFields) {
    if (values[fieldName]) {
      return values[fieldName];
    }
  }

  // This is really grim - nothing worked, return undefined and let the parent
  // function fall back to their preferred backup option
  return undefined;
}

/**
 * Converts field names to a more readable format by:
 * 1. Splitting CamelCase into separate words
 * 2. Replacing hyphens with spaces
 * 3. Removing all numeric characters
 * 4. Trimming any resulting extra whitespace
 *
 * @param fieldName - The input field name to prettify
 * @returns A cleaned and formatted string
 *
 * @example
 * prettifyFieldName("user-id-123") // returns "user id"
 * prettifyFieldName("order-number-456-status") // returns "order status"
 * prettifyFieldName("item-98-count") // returns "item count"
 * prettifyFieldName("userAccountID") // returns "user account id"
 * prettifyFieldName("LastLoginTime") // returns "last login time"
 * prettifyFieldName("APIResponse123") // returns "api response"
 */
export function prettifyFieldName(fieldName: string): string {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Split CamelCase by adding space between lower and upper case letters
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Handle consecutive capitals (e.g., APIResponse -> API Response)
    .replace(/-/g, ' ') // Replace all hyphens with spaces
    .replace(/[0-9]/g, '') // Remove all numbers
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace
}
