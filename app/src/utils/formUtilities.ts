import {ProjectUIModel, Record} from '@faims3/data-model';
import Mustache from 'mustache';
import {RecordContext} from '../gui/components/record/form';

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
  timestamp: string | number | null | undefined
): string {
  // Handle invalid inputs
  if (timestamp === null || timestamp === undefined) {
    return '';
  }

  // Convert string timestamps to numbers
  const timestampNum =
    typeof timestamp === 'string' ? Number(timestamp) : timestamp;

  // Validate if timestamp is a valid number
  if (isNaN(timestampNum) || !isFinite(timestampNum)) {
    return '';
  }

  try {
    const date = new Date(timestampNum);

    // Validate if date is valid
    if (date.toString() === 'Invalid Date') {
      return '';
    }

    // Get date components with safe fallbacks
    const day = String(date.getDate() || 0).padStart(2, '0');
    const month = String(date.getMonth() + 1 || 0).padStart(2, '0');
    const year = String(date.getFullYear() || 0).slice(-2);

    // Get time components with safe fallbacks
    let hours = date.getHours() || 0;
    const minutes = String(date.getMinutes() || 0).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';

    // Convert hours to 12-hour format
    hours = hours % 12;
    hours = hours || 12; // Convert 0 to 12

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
  if (context.createdBy) {
    vals[CREATOR_NAME_ID] = context.createdBy;
  }

  if (context.createdTime) {
    const displayTimestamp = formatTimestamp(context.createdTime);
    vals[CREATED_TIME_ID] = displayTimestamp;
  }

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
    if (!(k in excludedFields)) {
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
