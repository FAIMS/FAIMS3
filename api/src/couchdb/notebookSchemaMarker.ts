// SPDX-License-Identifier: Apache-2.0
/**
 * Read / write the notebook UI-schema marker
 * ({@link NOTEBOOK_UI_SCHEMA_MARKER_ID}) in the migrations DB.
 *
 * A boot doer writes it after `validateDatabases` to record "a build
 * targeting version X ran the notebook walk". The startup-migration ahead
 * check reads it instead of individual notebook `schemaVersion`s, which are
 * user-controlled (uploaded uiSpecs can carry any version).
 *
 * The recorded version only goes up: an older writer leaves a newer marker
 * untouched. Operators lower or delete it with `debug-migration-lock
 * reset-notebook-marker` (e.g. after a deliberate rollback).
 */
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  isNotebookUiSchemaMarker,
  mergeNotebookUiSchemaMarkerVersion,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  NOTEBOOK_UI_SCHEMA_MARKER_KIND,
  type NotebookUiSchemaMarkerDoc,
} from '@faims3/data-model';
import {isConflict, isNotFound} from './startupMigrationLock';

/** Attempts (initial + retries) when the marker put loses a 409 race. */
export const NOTEBOOK_SCHEMA_MARKER_WRITE_ATTEMPTS = 5;

/** Persistence used by the marker. Production passes the migrations DB. */
export type NotebookSchemaMarkerStore = {
  get: (id: string) => Promise<unknown>;
  put: (doc: NotebookUiSchemaMarkerDoc) => Promise<unknown>;
};

/** Marker document, or `null` when missing or not marker-shaped. */
export async function readNotebookSchemaMarker(
  db: NotebookSchemaMarkerStore
): Promise<NotebookUiSchemaMarkerDoc | null> {
  try {
    const doc = await db.get(NOTEBOOK_UI_SCHEMA_MARKER_ID);
    return isNotebookUiSchemaMarker(doc) ? doc : null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function readRawMarker(
  db: NotebookSchemaMarkerStore
): Promise<{_rev?: string; schemaVersion?: unknown} | null> {
  try {
    return (await db.get(NOTEBOOK_UI_SCHEMA_MARKER_ID)) as {
      _rev?: string;
      schemaVersion?: unknown;
    };
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Raise the marker to `schemaVersion` (default: this build's
 * {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}). A newer existing marker is
 * left untouched; a missing or non-semver one is overwritten. Retries 409s
 * up to `maxAttempts`, then throws. Other I/O errors throw immediately.
 *
 * @returns `written: false` when an existing newer marker was kept.
 */
export async function writeNotebookSchemaMarker(options: {
  db: NotebookSchemaMarkerStore;
  schemaVersion?: string;
  fingerprint?: string;
  apiVersion?: string;
  writerId?: string;
  now?: () => number;
  maxAttempts?: number;
}): Promise<{written: boolean; schemaVersion: string}> {
  const mine = options.schemaVersion ?? CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;
  const now = options.now ?? Date.now;
  const maxAttempts =
    options.maxAttempts ?? NOTEBOOK_SCHEMA_MARKER_WRITE_ATTEMPTS;

  for (let attempt = 1; ; attempt += 1) {
    const existing = await readRawMarker(options.db);
    const next = mergeNotebookUiSchemaMarkerVersion(
      existing?.schemaVersion,
      mine
    );
    if (existing && next !== mine) {
      return {written: false, schemaVersion: next};
    }
    const doc: NotebookUiSchemaMarkerDoc = {
      _id: NOTEBOOK_UI_SCHEMA_MARKER_ID,
      ...(existing?._rev !== undefined ? {_rev: existing._rev} : {}),
      kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
      schemaVersion: next,
      updatedAtMs: now(),
      ...(options.fingerprint !== undefined
        ? {fingerprint: options.fingerprint}
        : {}),
      ...(options.apiVersion !== undefined
        ? {apiVersion: options.apiVersion}
        : {}),
      ...(options.writerId !== undefined ? {writerId: options.writerId} : {}),
    };
    try {
      await options.db.put(doc);
      return {written: true, schemaVersion: next};
    } catch (error) {
      if (isConflict(error) && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
}
