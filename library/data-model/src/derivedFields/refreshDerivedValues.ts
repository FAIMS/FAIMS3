/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: refreshDerivedValues.ts
 * Description:
 *   Refreshes stored parent-derived values (#2245). Persist-on-save means a
 *   child's stored ParentFieldDisplay, templated and computed values are
 *   accurate as of its last save; if the parent changes and the child is not
 *   subsequently viewed, exports contain the stale value. This pass re-derives
 *   those values server-side using the same evaluation the form runs on view,
 *   and writes a new revision (credited to the given user) only where a value
 *   differs. Runs before export and behind a manual endpoint.
 *
 *   Only fields flagged by the dependency detector are written, so fields
 *   with no parent dependency (e.g. templates using only _CREATED_TIME) are
 *   never touched by this pass.
 */

import {DataEngine} from '../databaseEngine/engine';
import {FormUpdateData} from '../databaseEngine/types';
import {
  getParentDependentForms,
  ParentDependentField,
  ValuesObject,
} from '../uiSpecification';
import {recomputeComputedFields} from './computedFields';
import {logWarn} from './logging';
import {getRecordContextFromRecord} from './recordContext';
import {resolveParentFieldValue} from './resolveParentField';
import {resolveParentValues} from './resolveParentValues';
import {recomputeDerivedFields} from './templatedFields';

export interface RefreshDerivedValuesSummary {
  /** Form IDs that had parent-dependent fields and were processed. */
  forms: string[];
  recordsExamined: number;
  recordsUpdated: number;
  /** Records skipped due to per-record errors (e.g. merged heads). */
  recordsFailed: number;
}

/** Empty and missing compare equal, matching the form's behaviour where a
 * never-opened record's unset value and a resolved empty are the same. */
const isEmptyEqual = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) =>
    v === undefined || v === null || v === '' ? '' : v;
  return norm(a) === norm(b);
};

/**
 * Re-derives parent-dependent values for every record of every
 * parent-dependent form, writing a new revision where values changed.
 *
 * No-ops (zero summary) when the uiSpec has no parent-dependent forms.
 * Unchanged records produce no revision: changed fields are diffed here, and
 * the engine's AVP diffing provides a second guarantee underneath.
 *
 * @param engine The data engine for the project (uiSpec attached)
 * @param updatedBy User ID credited with any written revisions
 * @param pageSize Records fetched per page while iterating a form
 */
export const refreshDerivedValues = async ({
  engine,
  updatedBy,
  pageSize = 100,
}: {
  engine: DataEngine;
  updatedBy: string;
  pageSize?: number;
}): Promise<RefreshDerivedValuesSummary> => {
  const dependentForms = getParentDependentForms({
    uiSpecification: engine.uiSpec,
  });

  const summary: RefreshDerivedValuesSummary = {
    forms: [...dependentForms.keys()],
    recordsExamined: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
  };
  if (dependentForms.size === 0) return summary;

  for (const [formId, {fields}] of dependentForms) {
    // Field IDs writable by this pass, per dependency kind.
    const templateFields = fieldIdsOfKind(fields, 'template');
    const expressionFields = fieldIdsOfKind(fields, 'expression');
    const displayFields = fieldIdsOfKind(fields, 'parent-field-display');

    let startKey: string | undefined = undefined;
    for (;;) {
      const page = await engine.query.getRecords({
        formId,
        limit: pageSize,
        startKey,
      });

      for (const doc of page.records) {
        try {
          const outcome = await refreshRecord({
            engine,
            recordId: doc._id,
            formId,
            templateFields,
            expressionFields,
            displayFields,
            updatedBy,
          });
          if (outcome === 'deleted') continue;
          summary.recordsExamined++;
          if (outcome === 'updated') summary.recordsUpdated++;
        } catch (e) {
          summary.recordsExamined++;
          summary.recordsFailed++;
          logWarn(
            `refreshDerivedValues: failed to refresh record ${doc._id}`,
            e
          );
        }
      }

      if (!page.hasMore) break;
      startKey = page.nextStartKey;
    }
  }

  return summary;
};

const fieldIdsOfKind = (
  fields: ParentDependentField[],
  kind: ParentDependentField['kind']
): string[] => fields.filter(f => f.kind === kind).map(f => f.fieldId);

/** Re-derives one record's parent-dependent values; returns whether a new
 * revision was written. */
const refreshRecord = async ({
  engine,
  recordId,
  formId,
  templateFields,
  expressionFields,
  displayFields,
  updatedBy,
}: {
  engine: DataEngine;
  recordId: string;
  formId: string;
  templateFields: string[];
  expressionFields: string[];
  displayFields: string[];
  updatedBy: string;
}): Promise<'updated' | 'unchanged' | 'deleted'> => {
  const hydrated = await engine.hydrated.getHydratedRecord({recordId});
  // Soft-delete appends a head revision with deleted set; the pager's record
  // docs carry no flag, so this is the only reliable check.
  if (hydrated.record.deleted === true || hydrated.revision.deleted === true) {
    return 'deleted';
  }

  // Raw values, as the form sees them.
  const values: ValuesObject = {};
  for (const [k, v] of Object.entries(hydrated.data)) {
    values[k] = (v as {data?: unknown})?.data;
  }

  // Same context the form builds on view: creator, created time, and the
  // parent's current values.
  const context = getRecordContextFromRecord({record: hydrated.record});
  const parentValues = await resolveParentValues({engine, recordId, formId});
  if (parentValues) context.parentValues = parentValues;

  // Re-derive, keeping only updates for fields this pass may write.
  const changed: Record<string, unknown> = {};

  const templ = recomputeDerivedFields({
    values,
    uiSpecification: engine.uiSpec,
    formId,
    context,
  });
  for (const fieldId of templateFields) {
    if (
      fieldId in templ.updates &&
      !isEmptyEqual(values[fieldId], templ.updates[fieldId])
    ) {
      changed[fieldId] = templ.updates[fieldId];
    }
  }

  const comp = recomputeComputedFields({
    values,
    uiSpecification: engine.uiSpec,
    formId,
    context,
  });
  for (const fieldId of expressionFields) {
    if (
      fieldId in comp.updates &&
      !isEmptyEqual(values[fieldId], comp.updates[fieldId])
    ) {
      changed[fieldId] = comp.updates[fieldId];
    }
  }

  for (const fieldId of displayFields) {
    const parentFieldId =
      engine.uiSpec.fields[fieldId]?.['component-parameters']?.parentFieldId;
    if (typeof parentFieldId !== 'string') continue;
    const res = await resolveParentFieldValue({
      engine,
      recordId,
      parentFieldId,
    });
    // Empty when there is no parent or the field no longer exists, matching
    // the form so a stale value never survives.
    const resolved = res.kind === 'value' ? res.display : '';
    if (!isEmptyEqual(values[fieldId], resolved)) {
      changed[fieldId] = resolved;
    }
  }

  if (Object.keys(changed).length === 0) return 'unchanged';

  // Full wrapper map with changed data substituted, so annotations and
  // attachments ride through and no field reads as removed.
  const update: FormUpdateData = {};
  for (const [k, v] of Object.entries(hydrated.data)) {
    const entry = v as {
      data?: unknown;
      annotations?: unknown;
      faimsAttachments?: unknown;
    };
    update[k] = {
      data: k in changed ? changed[k] : entry.data,
      annotation: entry.annotations as FormUpdateData[string]['annotation'],
      attachments:
        entry.faimsAttachments as FormUpdateData[string]['attachments'],
    };
  }
  for (const k of Object.keys(changed)) {
    if (!(k in update)) {
      // Fresh entry for a field with no prior AVP; empty attachments here is
      // safe since the export loader treats present-but-empty as none.
      update[k] = {data: changed[k], attachments: []};
    }
  }

  // Revision-DAG mode: first revision has no parents ('new'); a single-parent
  // head updates in 'parent' mode; merged heads are skipped (they resolve
  // through the conflict machinery and self-heal on next client view).
  const parents = hydrated.revision.parents ?? [];
  if (parents.length > 1) {
    throw new Error(
      `record ${recordId} head has ${parents.length} parents (merged); skipping refresh`
    );
  }
  const mode = parents.length === 0 ? 'new' : 'parent';

  await engine.form.updateRevision({
    recordId,
    revisionId: hydrated.revision._id,
    update,
    mode,
    updatedBy,
  });

  // Reaching the write means this pass's own diff found changed values, so
  // count it; the engine's AVP diff underneath remains the no-churn backstop.
  return 'updated';
};
