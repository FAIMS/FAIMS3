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
 * Filename: resolveParentValues.ts
 * Description:
 *   Resolves the parent record's raw values for a child record. Lives in
 *   @faims3/data-model so the app and server-side evaluation share one
 *   implementation.
 */

import {DataEngine} from '../databaseEngine/engine';
import {getParentFormsForForm, ValuesObject} from '../uiSpecification';
import {referencedParentFields} from './parentFieldScan';
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
 * them as no-parent.
 */
export const resolveParentValues = async ({
  engine,
  recordId,
  formId,
}: {
  engine: DataEngine;
  recordId: string;
  formId: string;
}): Promise<ValuesObject | null> => {
  try {
    const own = await engine.hydrated.getHydratedRecord({recordId});
    const parents = own.revision.relationship?.parent ?? [];
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
    for (const rel of parents) {
      if (wanted !== null && wanted.length > 0) {
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
          });
          return unwrapFormData(parent.data);
        }
        return await engine.hydrated.getFieldValues({
          revisionId: heads[0],
          fields: wanted,
        });
      }
      const parent = await engine.form.getExistingFormData({
        recordId: rel.recordId,
      });
      if (!parentForms.has(parent.formId)) {
        continue;
      }
      return unwrapFormData(parent.data);
    }
    return null;
  } catch (e) {
    logWarn('resolveParentValues: failed to resolve parent record data', e);
    return null;
  }
};
