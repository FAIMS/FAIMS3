// SPDX-License-Identifier: Apache-2.0

import {afterEach, describe, expect, it, vi} from 'vitest';
import {sampleNotebook} from '../test-notebook';
import {
  designerDraftStorageKey,
  discardDraft,
  getDesignerDraftHostStatus,
  getDraft,
  hasUnpublishedDesignerDraft,
  isUnpublishedDraft,
  setDraft,
  type DesignerDraftKey,
} from './draftStorage';

const key: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

const published = structuredClone(sampleNotebook);
const edited = structuredClone(sampleNotebook);
edited.uiSpec.fields['New-Text-Field']['component-parameters'].label =
  'Edited label';
const publishedHash = 'a'.repeat(64);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('draftStorage', () => {
  it('round-trips a draft and published snapshot', () => {
    const result = setDraft(key, {draft: edited, published, publishedHash});
    expect(result).toEqual({ok: true});
    const stored = getDraft(key);
    expect(
      stored?.draft.uiSpec.fields['New-Text-Field']['component-parameters']
        .label
    ).toBe('Edited label');
    expect(
      stored?.published.uiSpec.fields['New-Text-Field']['component-parameters']
        .label
    ).toBe('Location Description');
  });

  it('isolates keys by user, resource kind, and resource id', () => {
    setDraft(key, {draft: edited, published, publishedHash});
    expect(getDraft({...key, userId: 'user-2'})).toBeUndefined();
    expect(getDraft({...key, resourceKind: 'templates'})).toBeUndefined();
    expect(getDraft({...key, resourceId: 'proj-2'})).toBeUndefined();
    expect(getDraft(key)).toBeDefined();
    expect(designerDraftStorageKey(key)).not.toBe(
      designerDraftStorageKey({...key, userId: 'user-2'})
    );
  });

  it('discard deletes the storage key', () => {
    setDraft(key, {draft: edited, published, publishedHash});
    discardDraft(key);
    expect(getDraft(key)).toBeUndefined();
    expect(localStorage.getItem(designerDraftStorageKey(key))).toBeNull();
  });

  it('compare-to-published is true after an edit and false after aligning', () => {
    expect(isUnpublishedDraft(published, published)).toBe(false);
    expect(isUnpublishedDraft(edited, published)).toBe(true);
    expect(isUnpublishedDraft(edited, edited)).toBe(false);
  });

  it('hasUnpublishedDesignerDraft is true only for a stored unpublished draft', () => {
    expect(hasUnpublishedDesignerDraft(key)).toBe(false);
    setDraft(key, {draft: edited, published, publishedHash});
    expect(hasUnpublishedDesignerDraft(key)).toBe(true);
    setDraft(key, {draft: published, published, publishedHash});
    expect(hasUnpublishedDesignerDraft(key)).toBe(false);
  });

  it('ignores a stored record that has no publishedHash', () => {
    localStorage.setItem(
      designerDraftStorageKey(key),
      JSON.stringify({
        version: 1,
        draft: edited,
        published,
        savedAt: Date.now(),
      })
    );
    expect(getDraft(key)).toBeUndefined();
  });

  it('marks a draft stale when the live uiSpec hash has moved', () => {
    setDraft(key, {
      draft: edited,
      published,
      publishedHash,
    });
    expect(
      getDesignerDraftHostStatus(key, {uiSpecHash: 'a'.repeat(64)}).stale
    ).toBe(false);
    expect(
      getDesignerDraftHostStatus(key, {uiSpecHash: 'b'.repeat(64)}).stale
    ).toBe(true);
  });

  it('surfaces a mocked quota setItem failure instead of swallowing it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException(
        'The quota has been exceeded.',
        'QuotaExceededError'
      );
    });
    const result = setDraft(key, {draft: edited, published, publishedHash});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/full|quota/i);
    }
    expect(getDraft(key)).toBeUndefined();
  });
});
