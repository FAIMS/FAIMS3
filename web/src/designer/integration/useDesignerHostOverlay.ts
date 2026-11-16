// SPDX-License-Identifier: Apache-2.0

/**
 * @file Shared Project / Template Actions wiring for the designer overlay.
 */

import {useCallback, useMemo, useState} from 'react';
import {closeDesignerHostOverlay} from './hostClose';
import type {DesignerDocumentMode} from './legacyNotebook';
import {
  designerLiveSnapshotFromRecord,
  toDesignerNotebookWithHistory,
  uiSpecHashFromRecord,
  type ApiRecordWithUiSpecification,
} from './notebookAdapters';
import {useDesignerDraftHostStatus} from './useHasUnpublishedDesignerDraft';
import {useDesignerSaveMutation} from './useDesignerSaveMutation';
import type {DesignerResourceKind} from './draftStorage';

export type DesignerHostRecord = ApiRecordWithUiSpecification & {
  name?: string;
  recordCount?: number;
};

type UseDesignerHostOverlayArgs = {
  userId: string;
  token?: string;
  resourceKind: DesignerResourceKind;
  resourceId: string;
  apiResourceType: 'notebooks' | 'templates';
  mode?: DesignerDocumentMode;
  data?: DesignerHostRecord;
  refetch: () => Promise<{data?: DesignerHostRecord}>;
};

/**
 * Draft chip, live GET, save mutation, and overlay close for one resource.
 */
export function useDesignerHostOverlay({
  userId,
  token,
  resourceKind,
  resourceId,
  apiResourceType,
  mode = 'project',
  data,
  refetch,
}: UseDesignerHostOverlayArgs) {
  const [editorOpen, setEditorOpen] = useState(false);
  const liveUiSpecHash = uiSpecHashFromRecord(data);
  const draftHost = useDesignerDraftHostStatus(
    {userId, resourceKind, resourceId},
    liveUiSpecHash ? {uiSpecHash: liveUiSpecHash} : undefined,
    editorOpen
  );

  const saveMutation = useDesignerSaveMutation({
    resourceType: resourceKind,
    apiResourceType,
    resourceId,
    token,
  });

  const initialNotebook = useMemo(
    () => toDesignerNotebookWithHistory(data, mode),
    [data, mode]
  );

  const refreshLiveDesign = useCallback(async () => {
    const result = await refetch();
    return designerLiveSnapshotFromRecord(result.data, mode);
  }, [refetch, mode]);

  const handleEditorClose = useCallback((file?: File) => {
    closeDesignerHostOverlay(() => setEditorOpen(false), file);
  }, []);

  return {
    editorOpen,
    setEditorOpen,
    draftHost,
    initialNotebook,
    isSaving: saveMutation.isPending,
    liveUiSpecHash,
    dialogProps: {
      notebook: initialNotebook,
      exportBaseName: data?.name,
      existingRecordCount: mode === 'template' ? undefined : data?.recordCount,
      onClose: handleEditorClose,
      userId,
      resourceKind,
      resourceId,
      publishNotebook: saveMutation.mutateAsyncWithToast,
      liveUiSpecHash,
      refreshLiveDesign,
      designerMode: mode,
    },
  };
}
