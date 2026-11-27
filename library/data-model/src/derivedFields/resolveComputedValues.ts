// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: resolveComputedValues.ts
 * Description:
 *   Resolves a record's computed field values at read time, so a value
 *   follows its inputs when a parent or linked record changes after the
 *   record's last save.
 */

import {
  ExprValue,
  fieldIdsForViewset,
  isMetadataRef,
  isParentRef,
  isRelatedRef,
  splitRelatedReference,
  ValuesObject,
} from '../uiSpecification';
import {isComputedFieldName, recomputeComputedFields} from './computedFields';
import {DerivedReadEngine} from './recordContext';
import {resolveParentValues} from './resolveParentValues';
import {linkedRecordId, resolveRelatedValues} from './resolveRelatedValues';

/**
 * Evaluates the computed fields of one record against its current inputs.
 *
 * Reads the parent or linked records only when an expression in the form
 * references them. A field whose inputs could not be read keeps its stored
 * value: a parent or linked record that has not synced yet must not blank it.
 *
 * @param values The record's raw stored values
 * @param parents The record's parent links, when the caller already holds them
 * @param metadataValues Notebook metadata; omitted leaves _METADATA fields stored
 * @param derivedDepth Hops already resolved to reach this record
 * @returns Computed values that differ from the stored ones, keyed by field
 */
export const resolveComputedValues = async ({
  engine,
  recordId,
  formId,
  values,
  parents,
  metadataValues,
  derivedDepth = 0,
}: {
  engine: DerivedReadEngine;
  recordId: string;
  formId: string;
  values: ValuesObject;
  parents?: ReadonlyArray<{recordId: string}>;
  metadataValues?: Record<string, string>;
  derivedDepth?: number;
}): Promise<Record<string, ExprValue | null>> => {
  const uiSpecification = engine.uiSpec;

  // Compiled references of each computed field in this form.
  const refsByField = new Map<string, string[]>();
  for (const fieldId of fieldIdsForViewset(uiSpecification, formId)) {
    const field = uiSpecification.fields[fieldId];
    if (field?.expressionRefs && isComputedFieldName(field['component-name'])) {
      refsByField.set(fieldId, field.expressionRefs);
    }
  }
  if (refsByField.size === 0) {
    return {};
  }

  const allRefs = Array.from(refsByField.values()).flat();
  const [parentValues, relatedValues] = await Promise.all([
    allRefs.some(isParentRef)
      ? resolveParentValues({
          engine,
          recordId,
          formId,
          parents,
          derivedDepth: derivedDepth + 1,
        })
      : null,
    allRefs.some(isRelatedRef)
      ? resolveRelatedValues({
          engine,
          values,
          formId,
          derivedDepth: derivedDepth + 1,
        })
      : {},
  ]);

  const {updates} = recomputeComputedFields({
    values,
    uiSpecification,
    formId,
    context: {
      parentValues: parentValues ?? undefined,
      relatedValues,
      metadataValues,
    },
  });

  // Whether a reference's source could not be read. A link field with no
  // link is a real blank, not a failed read.
  const unresolved = (ref: string): boolean => {
    if (isParentRef(ref)) return parentValues === null;
    if (isMetadataRef(ref)) return metadataValues === undefined;
    if (!isRelatedRef(ref)) return false;
    const relFieldId = splitRelatedReference(ref)?.relFieldId;
    return (
      relFieldId !== undefined &&
      linkedRecordId(values[relFieldId]) !== null &&
      !(relFieldId in relatedValues)
    );
  };
  // Walk in evaluation order so a field that reads an unresolved computed
  // field is unresolved too, and keeps its stored value with it.
  const rank = (fieldId: string) =>
    uiSpecification.fields[fieldId]?.expressionOrder ?? Number.MAX_SAFE_INTEGER;
  const unresolvedFields = new Set<string>();
  for (const [fieldId, refs] of Array.from(refsByField).sort(
    ([a], [b]) => rank(a) - rank(b)
  )) {
    if (refs.some(ref => unresolved(ref) || unresolvedFields.has(ref))) {
      unresolvedFields.add(fieldId);
      delete updates[fieldId];
    }
  }
  return updates;
};

/**
 * Applies resolved computed values to a record hydrated outside the engine
 * (record lists, exports), which holds raw values keyed by field.
 */
export const applyComputedValues = async <
  R extends {record_id: string; type: string; data?: ValuesObject},
>({
  engine,
  record,
  metadataValues,
}: {
  engine: DerivedReadEngine;
  record: R;
  metadataValues?: Record<string, string>;
}): Promise<R> => {
  if (!record.data) {
    return record;
  }
  const updates = await resolveComputedValues({
    engine,
    recordId: record.record_id,
    formId: record.type,
    values: record.data,
    metadataValues,
  });
  return Object.keys(updates).length === 0
    ? record
    : {...record, data: {...record.data, ...updates}};
};
