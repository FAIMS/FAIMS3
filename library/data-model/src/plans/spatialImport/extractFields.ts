/**
 * @file Pick a planned entry's field values out of a feature's attributes.
 * Attributes are matched by field id, and coerced to the field's returned type
 * the way the list-of-records config table does: numbers for Integer and
 * Number, booleans for Bool, strings otherwise.
 */
import type {MapCollectionRecordField} from '../mapCollectionPlan';

/** Outcome of coercing one attribute to a field's returned type. */
export type FieldCoercionResult =
  | {ok: true; value: unknown}
  | {ok: false; message: string};

const TRUE_STRINGS = new Set(['true', 'yes', 'y', '1']);
const FALSE_STRINGS = new Set(['false', 'no', 'n', '0']);

/** Coerce one attribute value to a field's returned type. */
export const coerceFieldValue = (
  raw: unknown,
  typeReturned: string | undefined
): FieldCoercionResult => {
  if (raw === undefined || raw === null || raw === '') {
    // Absent: the caller decides whether that is allowed
    return {ok: true, value: undefined};
  }
  switch (typeReturned) {
    case 'faims-core::Integer': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isInteger(n)) {
        return {ok: false, message: `${JSON.stringify(raw)} is not an integer`};
      }
      return {ok: true, value: n};
    }
    case 'faims-core::Number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) {
        return {ok: false, message: `${JSON.stringify(raw)} is not a number`};
      }
      return {ok: true, value: n};
    }
    case 'faims-core::Bool': {
      if (typeof raw === 'boolean') return {ok: true, value: raw};
      const text = String(raw).trim().toLowerCase();
      if (TRUE_STRINGS.has(text)) return {ok: true, value: true};
      if (FALSE_STRINGS.has(text)) return {ok: true, value: false};
      return {
        ok: false,
        message: `${JSON.stringify(raw)} is not a yes/no value`,
      };
    }
    default:
      return {ok: true, value: typeof raw === 'string' ? raw : String(raw)};
  }
};

/** Outcome of extracting a planned entry's field values from attributes. */
export type ExtractFieldsResult =
  | {ok: true; fields: Record<string, unknown>}
  | {ok: false; messages: string[]};

/**
 * Extract the template's record fields from a feature's attributes. Unknown
 * attributes are dropped; absent ones are left out rather than set.
 */
export const extractFields = ({
  properties,
  recordFields,
  fieldTypes,
}: {
  properties: Record<string, unknown>;
  recordFields: MapCollectionRecordField[];
  fieldTypes: Record<string, string | undefined>;
}): ExtractFieldsResult => {
  const fields: Record<string, unknown> = {};
  const messages: string[] = [];
  for (const {fieldId} of recordFields) {
    const coerced = coerceFieldValue(properties[fieldId], fieldTypes[fieldId]);
    if (!coerced.ok) {
      messages.push(`${fieldId}: ${coerced.message}`);
      continue;
    }
    if (coerced.value !== undefined) fields[fieldId] = coerced.value;
  }
  return messages.length > 0 ? {ok: false, messages} : {ok: true, fields};
};
