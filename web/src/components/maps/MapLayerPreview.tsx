// SPDX-License-Identifier: Apache-2.0
/**
 * Loads a ready map layer and shows a static fitted preview.
 */

import {Alert, AlertDescription} from '@/components/ui/alert';
import {config} from '@/constants';
import type {User} from '@/context/auth-provider';
import {
  isTiledMapAssetKind,
  mapAssetProcessingStatusText,
  type ExistingMapAsset,
  type GetMapAssetDownloadUrlResponse,
} from '@faims3/data-model';
import {
  readBlobRange,
  StaticMapLayerPreview,
  type TileByteRead,
} from '@faims3/forms';
import {useEffect, useState} from 'react';

/**
 * Fetch a presigned download and render a static fitted preview.
 * Shows processing/failed copy when the layer is not yet ready.
 */
export function MapLayerPreview({
  asset,
  user,
}: {
  asset: ExistingMapAsset;
  user: User;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const [readTileBytes, setReadTileBytes] = useState<
    TileByteRead | undefined
  >();
  const [error, setError] = useState('');

  useEffect(() => {
    if (asset.status !== 'ready' || !asset.kind) {
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    const load = async () => {
      try {
        const grant = await fetch(
          `${config.apiUrl}/api/map-assets/${asset._id}/download-url`,
          {headers: {Authorization: `Bearer ${user.token}`}}
        );
        if (!grant.ok) {
          throw new Error('Could not download the layer for preview.');
        }
        const {url: downloadUrl} =
          (await grant.json()) as GetMapAssetDownloadUrlResponse;
        if (!downloadUrl) {
          throw new Error('Could not download the layer for preview.');
        }
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error('Could not download the layer for preview.');
        }
        const blob = await response.blob();
        if (asset.kind && isTiledMapAssetKind(asset.kind)) {
          if (active) {
            setReadTileBytes(
              () => (offset: number, length: number) =>
                readBlobRange(blob, offset, length)
            );
            setUrl(`pmtiles:${asset._id}`);
            setError('');
          }
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setReadTileBytes(undefined);
          setUrl(objectUrl);
          setError('');
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not download the layer for preview.'
          );
        }
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [asset._id, asset.kind, asset.status, user.token]);

  if (asset.status === 'pending' || asset.status === 'processing') {
    const progress =
      mapAssetProcessingStatusText(asset) ??
      (asset.status === 'pending'
        ? 'This layer is waiting for a worker'
        : 'This layer is still processing');
    return (
      <p className="text-sm text-muted-foreground">
        {progress}. The preview appears when it is ready.
      </p>
    );
  }
  if (asset.status === 'failed') {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {asset.failureReason ?? 'This layer failed to process.'}
        </AlertDescription>
      </Alert>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!url || !asset.kind) {
    return <p className="text-sm text-muted-foreground">Loading preview…</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <StaticMapLayerPreview
        url={url}
        kind={asset.kind}
        extent4326={asset.extent4326}
        extent3857={asset.extent3857}
        readTileBytes={readTileBytes}
        minZoom={asset.minZoom}
        maxZoom={asset.maxZoom}
        style={asset.defaultStyle}
        mapConfig={config.mapConfig}
      />
    </div>
  );
}
