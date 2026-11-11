// SPDX-License-Identifier: Apache-2.0
import {config} from '@/constants';
import {
  ensureMapAssetPreviewDownload,
  getMapAssetPreviewState,
  IDLE_MAP_ASSET_PREVIEW_STATE,
  mapAssetPreviewCacheKey,
  mapAssetPreviewVersion,
  subscribeMapAssetPreview,
  type MapAssetPreviewState,
} from '@/lib/map-asset-preview-cache';
import type {ExistingMapAsset} from '@faims3/data-model';
import {useEffect, useState} from 'react';

/**
 * Subscribe to the preview download for a ready layer. When `start` is
 * true, begin or join the transfer. Unmounting does not abort it.
 */
export function useMapAssetPreviewDownload({
  asset,
  token,
  start,
}: {
  asset: ExistingMapAsset | undefined;
  token: string;
  start: boolean;
}): MapAssetPreviewState {
  const assetId = asset?._id;
  const ready = asset?.status === 'ready';
  const kind = asset?.kind;
  const version = asset && ready ? mapAssetPreviewVersion(asset) : '';
  const byteSize = asset?.byteSize ?? 0;
  const cacheKey =
    assetId && ready ? mapAssetPreviewCacheKey(assetId, version) : '';
  const [state, setState] = useState<MapAssetPreviewState>(() => {
    const current = cacheKey
      ? getMapAssetPreviewState(cacheKey)
      : IDLE_MAP_ASSET_PREVIEW_STATE;
    if (current.status === 'idle' && byteSize > 0) {
      return {...current, totalBytes: byteSize};
    }
    return current;
  });

  useEffect(() => {
    if (!assetId || !ready || !kind) {
      setState(IDLE_MAP_ASSET_PREVIEW_STATE);
      return;
    }
    const key = mapAssetPreviewCacheKey(assetId, version);
    setState(getMapAssetPreviewState(key));
    const unsubscribe = subscribeMapAssetPreview(key, setState);
    if (start) {
      void ensureMapAssetPreviewDownload({
        assetId,
        version,
        byteSize,
        token,
        apiUrl: config.apiUrl,
      }).catch(() => undefined);
    }
    return unsubscribe;
  }, [assetId, ready, kind, version, byteSize, start, token]);

  return state;
}
