// SPDX-License-Identifier: Apache-2.0

import {afterEach, describe, expect, it, vi} from 'vitest';
import {sampleNotebook} from '../test-notebook';
import {
  designerDraftStorageKey,
  discardDraft,
  getDraft,
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

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('draftStorage', () => {
  it('round-trips a draft and published snapshot', () => {
    const result = setDraft(key, {draft: edited, published});
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
    setDraft(key, {draft: edited, published});
    expect(getDraft({...key, userId: 'user-2'})).toBeUndefined();
    expect(getDraft({...key, resourceKind: 'templates'})).toBeUndefined();
    expect(getDraft({...key, resourceId: 'proj-2'})).toBeUndefined();
    expect(getDraft(key)).toBeDefined();
    expect(designerDraftStorageKey(key)).not.toBe(
      designerDraftStorageKey({...key, userId: 'user-2'})
    );
  });

  it('discard deletes the storage key', () => {
    setDraft(key, {draft: edited, published});
    discardDraft(key);
    expect(getDraft(key)).toBeUndefined();
    expect(localStorage.getItem(designerDraftStorageKey(key))).toBeNull();
  });

  it('compare-to-published is true after an edit and false after aligning', () => {
    expect(isUnpublishedDraft(published, published)).toBe(false);
    expect(isUnpublishedDraft(edited, published)).toBe(true);
    expect(isUnpublishedDraft(edited, edited)).toBe(false);
  });

  it('surfaces a mocked quota setItem failure instead of swallowing it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException(
        'The quota has been exceeded.',
        'QuotaExceededError'
      );
    });
    const result = setDraft(key, {draft: edited, published});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/full|quota/i);
    }
    expect(getDraft(key)).toBeUndefined();
  });
});
