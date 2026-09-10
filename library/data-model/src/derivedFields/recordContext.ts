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
 * Filename: recordContext.ts
 * Description:
 *   Record context for derived-value evaluation: creator, created time and,
 *   when resolved, the parent record's values. Lives in @faims3/data-model so
 *   the app and server-side evaluation share one implementation.
 */

import {HydratedRecordDocument} from '../databaseEngine/types';
import {
  CREATED_TIME_ID,
  CREATOR_NAME_ID,
  ValuesObject,
} from '../uiSpecification';
import {logWarn} from '../logging';
import {formatTimestamp} from '../utils';

export interface RecordContext {
  // timestamp ms created
  createdTime?: number;
  // First Last name of creator - if any
  createdBy?: string;
  // Raw field values of the parent record, if any (see resolveParentValues)
  parentValues?: ValuesObject;
  // Raw field values of records linked through single-link Related Records
  // fields, keyed by that field's ID (see resolveRelatedValues)
  relatedValues?: Record<string, ValuesObject>;
  // The notebook's custom metadata, referenced as _METADATA.<key>
  metadataValues?: Record<string, string>;
}

/**
 * Converts a record into record context used in the form
 */
export function getRecordContextFromRecord({
  record,
}: {
  record: HydratedRecordDocument;
}): RecordContext {
  let time = Date.now();
  try {
    time = new Date(record.created).getTime();
  } catch (e) {
    logWarn(
      'Failed to parse time from record. Falling back to current time. Err: ',
      e
    );
  }
  return {
    createdBy: record.createdBy,
    createdTime: time,
  };
}

/**
 * Converts the RecordContext into an object mapping from key -> value for use
 * in template replacement
 */
export function contextToTemplate(context: RecordContext): ValuesObject {
  const vals: ValuesObject = {};
  vals[CREATOR_NAME_ID] = context.createdBy ?? 'Unknown User';
  vals[CREATED_TIME_ID] = context.createdTime
    ? formatTimestamp(context.createdTime)
    : 'Unknown Time';
  return vals;
}
