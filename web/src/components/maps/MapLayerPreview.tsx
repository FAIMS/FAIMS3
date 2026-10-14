// SPDX-License-Identifier: Apache-2.0
/**
 * Loads a ready map layer and shows a static fitted preview.
 */

import {Alert, AlertDescription} from '@/components/ui/alert';
import {config} from '@/constants';
import type {User} from '@/context/auth-provider';
import type {
  ExistingMapAsset,
  GetMapAssetDownloadUrlResponse,
} from '@faims3/data-model';
import {StaticMapLayerPreview} from '@faims3/forms';
import {useEffect, useState} from 'react';

export function MapLayerPreview({
  asset,
  user,
}: {
  asset: ExistingMapAsset;
  user: User;
}) {
  const [url, setUrl] = useState<string | undefined>();
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
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) {
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

  if (asset.status === 'processing') {
    return (
      <p className="text-sm text-muted-foreground">
        This layer is still processing. The preview appears when it is ready.
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
        style={asset.defaultStyle}
        mapConfig={config.mapConfig}
      />
    </div>
  );
}
