// SPDX-License-Identifier: Apache-2.0

import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {sampleNotebook} from '../test-notebook';
import {setDraft, type DesignerDraftKey} from './draftStorage';
import {useDesignerHostOverlay} from './useDesignerHostOverlay';

const {mockPublish} = vi.hoisted(() => ({
  mockPublish: vi.fn(async () => ({})),
}));

vi.mock('./useDesignerSaveMutation', () => ({
  useDesignerSaveMutation: () => ({
    isPending: false,
    mutateAsyncWithToast: mockPublish,
  }),
}));

const key: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const record = {
  name: 'Survey',
  recordCount: 2,
  uiSpecification: sampleNotebook,
  uiSpecProperties: {hash: HASH_A},
};

afterEach(() => {
  localStorage.clear();
  mockPublish.mockClear();
});

describe('useDesignerHostOverlay', () => {
  it('refetches a live snapshot and never PUTs on close', async () => {
    const refetch = vi.fn().mockResolvedValue({data: record});
    const {result} = renderHook(() =>
      useDesignerHostOverlay({
        userId: key.userId,
        token: 'token',
        resourceKind: key.resourceKind,
        resourceId: key.resourceId,
        apiResourceType: 'notebooks',
        data: record,
        refetch,
      })
    );

    expect(result.current.initialNotebook).toBeDefined();
    expect(result.current.liveUiSpecHash).toBe(HASH_A);
    expect(result.current.draftHost.unpublished).toBe(false);

    act(() => {
      result.current.setEditorOpen(true);
    });
    expect(result.current.editorOpen).toBe(true);

    const snapshot = await result.current.dialogProps.refreshLiveDesign?.();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(snapshot?.liveUiSpecHash).toBe(HASH_A);
    expect(snapshot?.notebook).toBeDefined();

    act(() => {
      result.current.dialogProps.onClose(new File(['{}'], 'draft.json'));
    });
    expect(mockPublish).not.toHaveBeenCalled();
    expect(result.current.editorOpen).toBe(false);
  });

  it('marks the unpublished chip stale when the live hash has moved', () => {
    const edited = structuredClone(sampleNotebook);
    edited.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Draft';
    setDraft(key, {
      draft: edited,
      published: structuredClone(sampleNotebook),
      publishedHash: HASH_A,
    });

    const {result} = renderHook(() =>
      useDesignerHostOverlay({
        userId: key.userId,
        resourceKind: key.resourceKind,
        resourceId: key.resourceId,
        apiResourceType: 'notebooks',
        data: {...record, uiSpecProperties: {hash: HASH_B}},
        refetch: async () => ({data: record}),
      })
    );

    expect(result.current.draftHost.unpublished).toBe(true);
    expect(result.current.draftHost.stale).toBe(true);
    expect(result.current.liveUiSpecHash).toBe(HASH_B);
  });
});
