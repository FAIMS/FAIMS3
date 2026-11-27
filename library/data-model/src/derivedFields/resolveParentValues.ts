// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: resolveParentValues.ts
 * Description:
 *   Resolves the parent record's raw values for a child record. Lives in
 *   @faims3/data-model so the app and server-side evaluation share one
 *   implementation.
 */

import {getParentFormsForForm, ValuesObject} from '../uiSpecification';
import {isComputedFieldName} from './computedFields';
import {referencedParentFields} from './parentFieldScan';
import {DerivedReadEngine} from './recordContext';
import {logWarn} from '../logging';

/** Unwraps {data: ...} form entries to raw values. */
const unwrapFormData = (data: Record<string, unknown>): ValuesObject => {
  const values: ValuesObject = {};
  for (const [k, v] of Object.entries(data)) {
    values[k] = (v as {data?: unknown})?.data;
  }
  return values;
};

/**
 * Resolves the raw field values of this record's parent, for use in templated
 * strings ({{_PARENT.Field-ID}}) and computed expressions ({_PARENT.Field-ID}).
 *
 * Reads the parent relationship from the record's own revision, then loads
 * data from the first parent whose form can parent this record's form -
 * matching the resolution rule of the ParentFieldDisplay field. Values are
 * raw; formatting and typing happen at the point of use. Returns null when
 * there is no parent; resolution failures also return null so callers treat
 * them as no-parent. A deleted parent returns an empty object: it was read
 * and holds no values, so references to it are blank.
 */
export const resolveParentValues = async ({
  engine,
  recordId,
  formId,
  parents: knownParents,
  derivedDepth,
}: {
  engine: DerivedReadEngine;
  recordId: string;
  formId: string;
  /** The record's parent links, when the caller already holds them. */
  parents?: ReadonlyArray<{recordId: string}>;
  /** Passed to full parent reads; see getExistingFormData. */
  derivedDepth?: number;
}): Promise<ValuesObject | null> => {
  try {
    const parents =
      knownParents ??
      (await engine.hydrated.getHydratedRecord({recordId})).revision
        .relationship?.parent ??
      [];
    if (parents.length === 0) {
      return null;
    }

    const parentForms = new Set(
      getParentFormsForForm({uiSpecification: engine.uiSpec, formId})
    );

    // Fields the child's templates/expressions actually reference; null means
    // the scan could not be trusted, so fetch everything as before.
    const wanted = referencedParentFields({
      uiSpecification: engine.uiSpec,
      formId,
    });
    // A referenced field that is itself computed needs the full read, which
    // resolves it; a per-field fetch returns its stored value.
    const wantsComputed = (wanted ?? []).some(fieldId =>
      isComputedFieldName(
        engine.uiSpec.fields[fieldId]?.['component-name'] ?? ''
      )
    );
    for (const rel of parents) {
      if (wanted !== null && wanted.length > 0 && !wantsComputed) {
        // Cheap path: check the parent's form from its record document, then
        // fetch only the referenced fields from its head revision.
        const parentRecord = await engine.core.getRecord(rel.recordId);
        if (!parentForms.has(parentRecord.type)) {
          continue;
        }
        const heads = parentRecord.heads ?? [];
        if (heads.length !== 1) {
          // No head or a conflict - use the full path, which carries the
          // engine's head-selection semantics.
          const parent = await engine.form.getExistingFormData({
            recordId: rel.recordId,
            derivedDepth,
          });
          return parent.context?.revision.deleted === true
            ? {}
            : unwrapFormData(parent.data);
        }
        // The per-field fetch does not report deletion, so read the head.
        if ((await engine.core.getRevision(heads[0])).deleted === true) {
          return {};
        }
        return await engine.hydrated.getFieldValues({
          revisionId: heads[0],
          fields: wanted,
        });
      }
      const parent = await engine.form.getExistingFormData({
        recordId: rel.recordId,
        derivedDepth,
      });
      if (!parentForms.has(parent.formId)) {
        continue;
      }
      return parent.context?.revision.deleted === true
        ? {}
        : unwrapFormData(parent.data);
    }
    return null;
  } catch (e) {
    logWarn('resolveParentValues: failed to resolve parent record data', e);
    return null;
  }
};
