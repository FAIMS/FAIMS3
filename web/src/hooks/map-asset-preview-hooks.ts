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
  const cacheKey =
    asset && asset.status === 'ready'
      ? mapAssetPreviewCacheKey(asset._id, mapAssetPreviewVersion(asset))
      : '';
  const [state, setState] = useState<MapAssetPreviewState>(() => {
    const current = cacheKey
      ? getMapAssetPreviewState(cacheKey)
      : IDLE_MAP_ASSET_PREVIEW_STATE;
    if (current.status === 'idle' && asset && asset.byteSize > 0) {
      return {...current, totalBytes: asset.byteSize};
    }
    return current;
  });

  useEffect(() => {
    if (!asset || asset.status !== 'ready' || !asset.kind) {
      setState(IDLE_MAP_ASSET_PREVIEW_STATE);
      return;
    }
    const key = mapAssetPreviewCacheKey(
      asset._id,
      mapAssetPreviewVersion(asset)
    );
    setState(getMapAssetPreviewState(key));
    const unsubscribe = subscribeMapAssetPreview(key, setState);
    if (start) {
      void ensureMapAssetPreviewDownload({
        assetId: asset._id,
        version: mapAssetPreviewVersion(asset),
        byteSize: asset.byteSize,
        token,
        apiUrl: config.apiUrl,
      }).catch(() => undefined);
    }
    return unsubscribe;
  }, [asset, start, token]);

  return state;
}
