// SPDX-License-Identifier: Apache-2.0
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {displayDateTime} from '@/lib/time';
import {cn} from '@/lib/utils';
import {
  mapAssetKindLabel,
  type ExistingMapAsset,
  type MapAssetStatus,
} from '@faims3/data-model';
import {AlertCircle, CheckCircle2, LoaderCircle} from 'lucide-react';
import type {ReactNode} from 'react';

const statusIndication: Record<
  MapAssetStatus,
  {label: string; className: string; iconClassName: string}
> = {
  ready: {
    label: 'Ready',
    className:
      'border-green-800/40 bg-green-800/[0.08] text-green-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300',
    iconClassName: 'text-green-800 dark:text-emerald-300',
  },
  processing: {
    label: 'Processing',
    className: 'border-info/40 bg-info/10 text-info',
    iconClassName: 'text-info',
  },
  failed: {
    label: 'Failed',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    iconClassName: 'text-destructive',
  },
};

function MapLayerStatusIndication({asset}: {asset: ExistingMapAsset}) {
  const indication = statusIndication[asset.status];
  const Icon =
    asset.status === 'ready'
      ? CheckCircle2
      : asset.status === 'failed'
        ? AlertCircle
        : LoaderCircle;

  return (
    <div className="space-y-1.5" data-testid="web-map-layer-status">
      <Badge
        variant="outline"
        className={cn('gap-1.5 font-medium', indication.className)}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            indication.iconClassName,
            asset.status === 'processing' && 'animate-spin'
          )}
          aria-hidden
        />
        {indication.label}
      </Badge>
      {asset.status === 'failed' ? (
        <p className="text-sm text-destructive">
          {asset.failureReason ?? 'This layer failed to process.'}
        </p>
      ) : null}
      {asset.status === 'processing' ? (
        <p className="text-sm text-muted-foreground">
          This layer is being prepared for devices.
        </p>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '—';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    {key: 'size', label: 'Size', value: asset => formatBytes(asset.byteSize)},
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
