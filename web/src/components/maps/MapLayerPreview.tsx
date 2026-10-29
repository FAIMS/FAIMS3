// SPDX-License-Identifier: Apache-2.0
/**
 * Loads a ready map layer and shows an interactive fitted preview.
 */

import {MapLayerPreviewProgress} from '@/components/maps/MapLayerPreviewProgress';
import {Alert, AlertDescription} from '@/components/ui/alert';
import {config} from '@/constants';
import type {User} from '@/context/auth-provider';
import {useMapAssetPreviewDownload} from '@/hooks/map-asset-preview-hooks';
import {
  isTiledMapAssetKind,
  mapAssetProcessingStatusText,
  type ExistingMapAsset,
} from '@faims3/data-model';
import {
  readBlobRange,
  InteractiveMapLayerPreview,
  type TileByteRead,
} from '@faims3/forms';
import {useEffect, useState} from 'react';

/**
 * Fetch a presigned download (cached after the first transfer) and render
 * an interactive fitted preview. Shows processing/failed copy when the layer
 * is not yet ready, and download progress while the file is arriving.
 */
export function MapLayerPreview({
  asset,
  user,
}: {
  asset: ExistingMapAsset;
  user: User;
}) {
  const download = useMapAssetPreviewDownload({
    asset,
    token: user.token,
    start: true,
  });
  const [url, setUrl] = useState<string | undefined>();
  const [readTileBytes, setReadTileBytes] = useState<
    TileByteRead | undefined
  >();

  useEffect(() => {
    const blob = download.blob;
    if (!blob || !asset.kind) {
      setUrl(undefined);
      setReadTileBytes(undefined);
      return;
    }
    if (isTiledMapAssetKind(asset.kind)) {
      setReadTileBytes(
        () => (offset: number, length: number) =>
          readBlobRange(blob, offset, length)
      );
      setUrl(`pmtiles:${asset._id}`);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setReadTileBytes(undefined);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [asset._id, asset.kind, download.blob]);

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
  if (download.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {download.error ?? 'Could not download the layer for preview.'}
        </AlertDescription>
      </Alert>
    );
  }
  if (!url || !asset.kind) {
    return <MapLayerPreviewProgress download={download} />;
  }
  return (
    <div className="rounded-md border">
      <InteractiveMapLayerPreview
        id={asset._id}
        name={asset.name}
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
