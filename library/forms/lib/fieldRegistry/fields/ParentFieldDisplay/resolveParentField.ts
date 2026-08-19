import {DataEngine, getFieldToIdsMap} from '@faims3/data-model';

/** Outcome of resolving a parent field value for display. */
export type ParentFieldResolution =
  | {kind: 'no-parent'}
  | {kind: 'field-not-found'}
  | {kind: 'value'; display: string};

/**
 * Formats a stored field value into a display string. Objects are JSON
 * stringified as a fallback; complex field types can be special-cased later.
 */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.map(v => formatFieldValue(v)).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Resolves the value of a field on this record's parent.
 *
 * Reads the parent relationship from the record's own revision, then loads
 * form data from the first parent whose form actually contains the configured
 * field (a record may have parents of more than one form type).
 */
export async function resolveParentFieldValue({
  engine,
  recordId,
  parentFieldId,
}: {
  engine: DataEngine;
  recordId: string;
  parentFieldId: string;
}): Promise<ParentFieldResolution> {
  const own = await engine.hydrated.getHydratedRecord({recordId});
  const parents = own.revision.relationship?.parent ?? [];
  if (parents.length === 0) {
    return {kind: 'no-parent'};
  }

  // Which form does the configured field belong to?
  const fieldMap = getFieldToIdsMap(engine.uiSpec);
  const location = fieldMap[parentFieldId];
  if (!location) {
    return {kind: 'field-not-found'};
  }

  for (const rel of parents) {
    const parent = await engine.form.getExistingFormData({
      recordId: rel.recordId,
    });
    if (parent.formId !== location.viewSetId) {
      continue;
    }
    return {
      kind: 'value',
      display: formatFieldValue(parent.data[parentFieldId]?.data),
    };
  }

  return {kind: 'field-not-found'};
}
