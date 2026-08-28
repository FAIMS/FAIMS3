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
 * Filename: resolveRelatedValues.ts
 * Description:
 *   Resolves the raw values of records linked through single-link Linked
 *   Related Records fields. Lives in @faims3/data-model so the app and
 *   server-side evaluation share one implementation.
 */

import {DataEngine} from '../databaseEngine/engine';
import {getRelatedRecordFields, ValuesObject} from '../uiSpecification';
import {logWarn} from '../logging';

/** A single stored link, as written by the Related Records field. */
type LinkEntry = {record_id?: string};

/**
 * Picks the one link from a single-link field's value. Tolerates a one-entry
 * array (data written while the field allowed multiple) and rejects anything
 * else, so a reference never silently reads an arbitrary record.
 */
const singleLink = (raw: unknown): LinkEntry | null => {
  const entry = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : null) : raw;
  return entry && typeof entry === 'object' && 'record_id' in entry
    ? (entry as LinkEntry)
    : null;
};

/** The record ID a single-link field value points at, or null. Used by the
 * form manager to detect link changes without re-resolving on every edit. */
export const linkedRecordId = (raw: unknown): string | null =>
  singleLink(raw)?.record_id ?? null;

/**
 * Resolves the raw field values of every record linked through a single-link
 * Linked Related Records field on this form, keyed by that field's ID, for
 * use in templated strings ({{Rel-Field-ID.Field-ID}}) and computed
 * expressions ({Rel-Field-ID.Field-ID}).
 *
 * Reads the links from the supplied form values rather than a stored
 * revision, so callers can re-resolve when a link changes during editing.
 * A field with no link, an unresolvable link, or a link to a record of the
 * wrong form contributes no entry; callers treat a missing entry as no value.
 */
export const resolveRelatedValues = async ({
  engine,
  values,
  formId,
}: {
  engine: DataEngine;
  values: ValuesObject;
  formId: string;
}): Promise<Record<string, ValuesObject>> => {
  const resolved: Record<string, ValuesObject> = {};
  const relatedFields = getRelatedRecordFields({
    uiSpecification: engine.uiSpec,
    formId,
  });

  for (const [relFieldId, info] of relatedFields) {
    if (info.multiple) continue;
    const link = singleLink(values[relFieldId]);
    if (!link?.record_id) continue;
    try {
      const record = await engine.form.getExistingFormData({
        recordId: link.record_id,
      });
      if (record.formId !== info.relatedFormId) continue;
      // Unwrap {data: ...} entries to raw values.
      const relValues: ValuesObject = {};
      for (const [k, v] of Object.entries(record.data)) {
        relValues[k] = (v as {data?: unknown})?.data;
      }
      resolved[relFieldId] = relValues;
    } catch (e) {
      logWarn(
        `resolveRelatedValues: failed to resolve record linked via "${relFieldId}"`,
        e
      );
    }
  }
  return resolved;
};
