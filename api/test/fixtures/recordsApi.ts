// SPDX-License-Identifier: Apache-2.0

/*
 * Fixtures and helpers for Records API tests.
 * Backup/form ids live here; request/response shapes match @faims3/data-model api types
 * (same as api/src/api/records.ts).
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

export type BackupFormId =
  (typeof BACKUP_FORM_IDS)[keyof typeof BACKUP_FORM_IDS];

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
