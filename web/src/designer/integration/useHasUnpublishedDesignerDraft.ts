// SPDX-License-Identifier: Apache-2.0

import {useEffect, useState} from 'react';
import {
  designerDraftStorageKey,
  getDesignerDraftHostStatus,
  type DesignerDraftHostStatus,
  type DesignerDraftKey,
  type DesignerLiveDesignRef,
} from './draftStorage';

/**
 * Unpublished / stale-vs-live status for the Actions-tab editor card.
 * Re-reads when `refreshToken` changes and when another tab writes the key.
 */
export function useDesignerDraftHostStatus(
  key: DesignerDraftKey,
  live?: DesignerLiveDesignRef,
  refreshToken?: unknown
): DesignerDraftHostStatus {
  const [status, setStatus] = useState(() =>
    getDesignerDraftHostStatus(key, live)
  );

  useEffect(() => {
    const read = () => setStatus(getDesignerDraftHostStatus(key, live));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === designerDraftStorageKey(key)) {
        read();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [
    key.resourceId,
    key.resourceKind,
    key.userId,
    live?.uiSpecHash,
    refreshToken,
  ]);

  return status;
}

/**
 * Whether this user and resource have an unpublished local draft.
 */
export function useHasUnpublishedDesignerDraft(
  key: DesignerDraftKey,
  refreshToken?: unknown
): boolean {
  return useDesignerDraftHostStatus(key, undefined, refreshToken).unpublished;
}
