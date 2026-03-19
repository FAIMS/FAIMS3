/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Fixtures, types, and path helpers for Records CRUD API tests.
 * Single source of truth for backup project id, form ids, and API contract types.
 */

import {restoreFromBackup} from '../../src/couchdb/backupRestore';

// ---------------------------------------------------------------------------
// Backup fixture (must match test/backup.jsonl content)
// ---------------------------------------------------------------------------

export const RECORDS_BACKUP_FILENAME = 'test/backup.jsonl';

/** Project ID of the notebook in RECORDS_BACKUP_FILENAME */
export const RECORDS_BACKUP_PROJECT_ID = '1693291182736-campus-survey-demo';

/** Form/viewset IDs present in the backup notebook (for create/update tests) */
export const BACKUP_FORM_IDS = {
  FORM1: 'FORM1',
  FORM2: 'FORM2',
} as const;

export type BackupFormId = (typeof BACKUP_FORM_IDS)[keyof typeof BACKUP_FORM_IDS];

// ---------------------------------------------------------------------------
// API path builders
// ---------------------------------------------------------------------------

const NOTEBOOKS_BASE = '/api/notebooks';

/** Base path for records API: GET list, POST create */
export function recordsBasePath(projectId: string): string {
  return `${NOTEBOOKS_BASE}/${projectId}/records`;
}

/** Path for a single record: GET, PATCH, DELETE */
export function recordPath(projectId: string, recordId: string): string {
  return `${recordsBasePath(projectId)}/${recordId}`;
}

// ---------------------------------------------------------------------------
// API response types (match API contract)
// ---------------------------------------------------------------------------

export interface CreateRecordResponse {
  recordId: string;
  revisionId: string;
}

export interface MinimalRecordInList {
  projectId: string;
  recordId: string;
  revisionId: string;
  created: string;
  createdBy: string;
  updated: string;
  updatedBy: string;
  conflicts: boolean;
  deleted: boolean;
  type: string;
  relationship?: unknown;
}

export interface ListRecordsResponse {
  records: MinimalRecordInList[];
}

export interface FormDataEntryValue {
  data: unknown;
  annotation?: {annotation: string; uncertainty: boolean};
  attachments?: Array<{attachmentId: string; filename: string; fileType: string}>;
}

export interface GetRecordResponse {
  formId: string;
  revisionId: string;
  data: Record<string, FormDataEntryValue>;
  context: {
    record: unknown;
    revision: unknown;
    hrid: string | null;
  };
}

export interface UpdateRecordResponse {
  revisionId: string;
}

// ---------------------------------------------------------------------------
// Request body types (for type-safe test payloads)
// ---------------------------------------------------------------------------

export interface CreateRecordBody {
  formId: string;
  createdBy?: string;
  relationship?: {
    parent?: Array<{recordId: string; fieldId: string; relationTypeVocabPair: [string, string]}>;
    linked?: Array<{recordId: string; fieldId: string; relationTypeVocabPair: [string, string]}>;
  };
}

export interface FormDataEntry {
  data: unknown;
  annotation?: {annotation: string; uncertainty: boolean};
  attachments?: Array<{attachmentId: string; filename: string; fileType: string}>;
}

export interface UpdateRecordBody {
  revisionId: string;
  update: Record<string, FormDataEntry>;
  mode?: 'new' | 'parent';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a test body after restoring the records backup. Avoids repeating restore + project id in every test. */
export async function withRecordsBackup<T>(
  fn: (projectId: string) => Promise<T>
): Promise<T> {
  await restoreFromBackup({filename: RECORDS_BACKUP_FILENAME});
  return fn(RECORDS_BACKUP_PROJECT_ID);
}

/** ID prefix constants for assertions */
export const RECORD_ID_PREFIX = 'rec-';
export const REVISION_ID_PREFIX = 'frev-';
