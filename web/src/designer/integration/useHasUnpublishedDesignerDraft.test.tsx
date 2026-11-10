// SPDX-License-Identifier: Apache-2.0

import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {sampleNotebook} from '../test-notebook';
import {discardDraft, setDraft, type DesignerDraftKey} from './draftStorage';
import {
  useDesignerDraftHostStatus,
  useHasUnpublishedDesignerDraft,
} from './useHasUnpublishedDesignerDraft';

const key: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

const publishedHash = 'a'.repeat(64);

afterEach(() => {
  localStorage.clear();
});

describe('useHasUnpublishedDesignerDraft', () => {
  it('becomes true after a draft is stored and false after discard on refresh', () => {
    const {result, rerender} = renderHook(
      ({refresh}: {refresh: number}) =>
        useHasUnpublishedDesignerDraft(key, refresh),
      {initialProps: {refresh: 0}}
    );
    expect(result.current).toBe(false);

    const edited = structuredClone(sampleNotebook);
    edited.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Unpublished';
    setDraft(key, {
      draft: edited,
      published: structuredClone(sampleNotebook),
      publishedHash,
    });
    rerender({refresh: 1});
    expect(result.current).toBe(true);

    discardDraft(key);
    rerender({refresh: 2});
    expect(result.current).toBe(false);
  });

  it('updates when another tab writes the matching storage key', () => {
    const {result} = renderHook(() => useHasUnpublishedDesignerDraft(key));
    expect(result.current).toBe(false);

    const edited = structuredClone(sampleNotebook);
    edited.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'From other tab';
    setDraft(key, {
      draft: edited,
      published: structuredClone(sampleNotebook),
      publishedHash,
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {key: null}));
    });
    expect(result.current).toBe(true);
  });
});

describe('useDesignerDraftHostStatus', () => {
  it('marks unpublished drafts stale when the live hash has moved', () => {
    const edited = structuredClone(sampleNotebook);
    edited.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Old draft';
    setDraft(key, {
      draft: edited,
      published: structuredClone(sampleNotebook),
      publishedHash: 'a'.repeat(64),
    });

    const {result, rerender} = renderHook(
      ({hash}: {hash: string}) =>
        useDesignerDraftHostStatus(key, {uiSpecHash: hash}),
      {initialProps: {hash: 'a'.repeat(64)}}
    );
    expect(result.current).toEqual({unpublished: true, stale: false});

    rerender({hash: 'b'.repeat(64)});
    expect(result.current).toEqual({unpublished: true, stale: true});
  });
});
