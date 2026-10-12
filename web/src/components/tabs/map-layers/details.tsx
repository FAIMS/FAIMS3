// SPDX-License-Identifier: Apache-2.0
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {displayDateTime} from '@/lib/time';
import type {ExistingMapAsset} from '@faims3/data-model';
import type {ReactNode} from 'react';

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '—';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusText(asset: ExistingMapAsset): string {
  if (asset.status === 'processing') {
    return 'Processing';
  }
  if (asset.status === 'failed') {
    return asset.failureReason ?? 'Failed';
  }
  return 'Ready';
}

export function MapLayerDetails({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const {data, isPending} = useMapAsset({user, assetId});

  const rows: {
    key: string;
    label: string;
    value: (asset: ExistingMapAsset) => ReactNode;
  }[] = [
    {key: 'name', label: 'Name', value: asset => asset.name},
    {
      key: 'description',
      label: 'Description',
      value: asset => asset.description || '—',
    },
    {key: 'status', label: 'Status', value: statusText},
    {
      key: 'kind',
      label: 'Type',
      value: asset =>
        asset.kind === 'image'
          ? 'Image'
          : asset.kind === 'geojson'
            ? 'Vector'
            : '—',
    },
    {key: 'size', label: 'Size', value: asset => formatBytes(asset.byteSize)},
    {
      key: 'quality',
      label: 'Device quality',
      value: asset =>
        asset.quality === undefined
          ? '—'
          : `${asset.quality} · ${
              asset.normalizeOptions
                ? `up to ${asset.normalizeOptions.maxRasterEdgePx} px`
                : 'default'
            }`,
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
            ) : (
              <ListDescription>{row.value(data)}</ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
}
