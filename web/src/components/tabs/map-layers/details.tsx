// SPDX-License-Identifier: Apache-2.0
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {MapLayerStatusBadge} from '@/components/tables/map-layer-status';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {displayDateTime} from '@/lib/time';
import {
  formatFileSize,
  isMapAssetReadyToLink,
  mapAssetKindLabel,
  mapAssetProcessingStatusText,
  type MapAssetWithLinkCount,
} from '@faims3/data-model';
import type {ReactNode} from 'react';

/** Status badge plus processing progress or failure reason. */
function MapLayerStatusIndication({asset}: {asset: MapAssetWithLinkCount}) {
  return (
    <div className="space-y-1.5" data-testid="web-map-layer-status">
      <MapLayerStatusBadge
        asset={asset}
        linkToLinkingTab={isMapAssetReadyToLink(asset)}
      />
      {asset.status === 'failed' ? (
        <p className="text-sm text-destructive">
          {asset.failureReason ?? 'This layer failed to process.'}
        </p>
      ) : null}
      {asset.status === 'pending' || asset.status === 'processing' ? (
        <p className="text-sm text-muted-foreground">
          {mapAssetProcessingStatusText(asset) ??
            (asset.status === 'pending'
              ? 'Waiting for a worker to prepare this layer for devices.'
              : 'This layer is being prepared for devices.')}
        </p>
      ) : null}
    </div>
  );
}

/** Metadata card: status, kind, size, team, owner, and timestamps. */
export function MapLayerDetails({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const {data, isPending} = useMapAsset({user, assetId});

  const rows: {
    key: string;
    label: string;
    value: (asset: MapAssetWithLinkCount) => ReactNode;
  }[] = [
    {key: 'name', label: 'Name', value: asset => asset.name},
    {
      key: 'description',
      label: 'Description',
      value: asset => asset.description || '—',
    },
    {
      key: 'status',
      label: 'Status',
      value: asset => <MapLayerStatusIndication asset={asset} />,
    },
    {
      key: 'kind',
      label: 'Type',
      value: asset => mapAssetKindLabel(asset.kind) || '—',
    },
    {
      key: 'size',
      label: 'Size',
      value: asset =>
        asset.byteSize > 0 ? formatFileSize(asset.byteSize) : '—',
    },
    {
      key: 'file',
      label: 'Original file',
      value: asset => asset.originalFilename,
    },
    {
      key: 'team',
      label: 'Team',
      value: asset =>
        asset.ownedByTeamId ? (
          <TeamCellComponent teamId={asset.ownedByTeamId} />
        ) : (
          '-'
        ),
    },
    {key: 'createdBy', label: 'Owner', value: asset => asset.createdBy},
    {
      key: 'createdAt',
      label: 'Created',
      value: asset => displayDateTime({timestamp: asset.createdAt}),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      value: asset => displayDateTime({timestamp: asset.updatedAt}),
    },
  ];

  return (
    <Card>
      <List>
        {rows.map(row => (
          <ListItem key={row.key}>
            <ListLabel>{row.label}</ListLabel>
            {isPending || !data ? (
              <Skeleton />
            ) : row.key === 'status' ? (
              row.value(data)
            ) : (
              <ListDescription>{row.value(data)}</ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
}
