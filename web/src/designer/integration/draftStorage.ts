// SPDX-License-Identifier: Apache-2.0

/**
 * @file Origin-private designer draft storage keyed by user, resource kind, and id.
 */

import type {Notebook} from '../state/initial';

/** Host resource collection used in draft keys and React Query cache keys. */
export type DesignerResourceKind = 'projects' | 'templates';

/** Identity that must be unique per signed-in user and resource. */
export type DesignerDraftKey = {
  userId: string;
  resourceKind: DesignerResourceKind;
  resourceId: string;
};

/** Result of a localStorage write: success, or an observable failure. */
export type DraftWriteResult = {ok: true} | {ok: false; error: string};

/** Persisted working copy plus the last successfully published snapshot. */
export type DesignerDraftRecord = {
  version: 1;
  draft: Notebook;
  published: Notebook;
  savedAt: number;
};

const DRAFT_RECORD_VERSION = 1;

/**
 * localStorage key for one designer draft. Encodes each segment so user ids
 * and resource ids cannot collide across `:` or other reserved characters.
 */
export function designerDraftStorageKey(key: DesignerDraftKey): string {
  return [
    'faims3',
    'designer-draft',
    `v${DRAFT_RECORD_VERSION}`,
    encodeURIComponent(key.userId),
    encodeURIComponent(key.resourceKind),
    encodeURIComponent(key.resourceId),
  ].join(':');
}

/**
 * Stable JSON serialisation: object keys are sorted recursively so unpublished
 * compare does not depend on insertion order.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortValue(obj[key]);
  }
  return sorted;
}

/**
 * True when the draft export is not deep-equal to the last published snapshot.
 */
export function isUnpublishedDraft(
  draft: unknown,
  published: unknown
): boolean {
  return stableStringify(draft) !== stableStringify(published);
}

function defaultStorage(): Storage | undefined {
  try {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }
    return localStorage;
  } catch {
    return undefined;
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22
    );
  }
  return false;
}

function writeErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return 'Browser storage is full; the local draft could not be saved.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'The local draft could not be saved.';
}

function isDraftRecord(value: unknown): value is DesignerDraftRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Partial<DesignerDraftRecord>;
  return (
    record.version === DRAFT_RECORD_VERSION &&
    typeof record.draft === 'object' &&
    record.draft !== null &&
    typeof record.published === 'object' &&
    record.published !== null
  );
}

/**
 * Read a stored draft for this user and resource, or `undefined` if missing
 * or unreadable.
 */
export function getDraft(
  key: DesignerDraftKey,
  storage: Storage | undefined = defaultStorage()
): DesignerDraftRecord | undefined {
  if (!storage) {
    return undefined;
  }
  try {
    const raw = storage.getItem(designerDraftStorageKey(key));
    if (!raw) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    return isDraftRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write the present notebook export and last-published snapshot. Quota or
 * `setItem` failures are returned, never swallowed.
 */
export function setDraft(
  key: DesignerDraftKey,
  record: {draft: Notebook; published: Notebook},
  storage: Storage | undefined = defaultStorage()
): DraftWriteResult {
  if (!storage) {
    return {ok: false, error: 'Browser storage is not available.'};
  }
  const payload: DesignerDraftRecord = {
    version: DRAFT_RECORD_VERSION,
    draft: record.draft,
    published: record.published,
    savedAt: Date.now(),
  };
  try {
    storage.setItem(designerDraftStorageKey(key), JSON.stringify(payload));
    return {ok: true};
  } catch (error) {
    return {ok: false, error: writeErrorMessage(error)};
  }
}

/**
 * Remove the stored draft for this user and resource.
 */
export function discardDraft(
  key: DesignerDraftKey,
  storage: Storage | undefined = defaultStorage()
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(designerDraftStorageKey(key));
  } catch {
    // Discard is best-effort; a missing key is already the desired state.
  }
}
