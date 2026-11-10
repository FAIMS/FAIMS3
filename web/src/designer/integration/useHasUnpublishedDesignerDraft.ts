// SPDX-License-Identifier: Apache-2.0

import {useEffect, useState} from 'react';
import {
  designerDraftStorageKey,
  hasUnpublishedDesignerDraft,
  type DesignerDraftKey,
} from './draftStorage';

/**
 * Whether this user and resource have an unpublished local draft. Re-reads when
 * `refreshToken` changes (for example when the editor overlay closes) and when
 * another tab writes the same storage key.
 */
export function useHasUnpublishedDesignerDraft(
  key: DesignerDraftKey,
  refreshToken?: unknown
): boolean {
  const [hasUnpublished, setHasUnpublished] = useState(() =>
    hasUnpublishedDesignerDraft(key)
  );

  useEffect(() => {
    const read = () => setHasUnpublished(hasUnpublishedDesignerDraft(key));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === designerDraftStorageKey(key)) {
        read();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key.resourceId, key.resourceKind, key.userId, refreshToken]);

  return hasUnpublished;
}
