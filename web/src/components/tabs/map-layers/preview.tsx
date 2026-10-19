// SPDX-License-Identifier: Apache-2.0
import {MapLayerPreview} from '@/components/maps/MapLayerPreview';
import {Skeleton} from '@/components/ui/skeleton';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';

export function MapLayerPreviewTab({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const {data, isPending, isError} = useMapAsset({user, assetId});

  if (isPending) {
    return <Skeleton className="w-full h-map-layer-preview" />;
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">Could not load this map layer.</p>
    );
  }
  return <MapLayerPreview asset={data} user={user} />;
}
