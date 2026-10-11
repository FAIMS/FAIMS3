// SPDX-License-Identifier: Apache-2.0
import {DataTableColumnHeader} from '@/components/data-table/column-header';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Badge} from '@/components/ui/badge';
import {displayDateTime} from '@/lib/time';
import type {ExistingMapAsset} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '—';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(asset: ExistingMapAsset): string {
  if (asset.status === 'processing') {
    return 'Processing';
  }
  if (asset.status === 'failed') {
    return 'Failed';
  }
  return 'Ready';
}

const nameColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'name',
  header: ({column}) => <DataTableColumnHeader column={column} title="Name" />,
};

const statusColumn: ColumnDef<ExistingMapAsset> = {
  id: 'status',
  accessorFn: statusLabel,
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Status" />
  ),
  cell: ({row}) => {
    const label = statusLabel(row.original);
    const variant =
      row.original.status === 'failed'
        ? 'destructive'
        : row.original.status === 'ready'
          ? 'secondary'
          : 'outline';
    return <Badge variant={variant}>{label}</Badge>;
  },
};

const typeColumn: ColumnDef<ExistingMapAsset> = {
  id: 'kind',
  accessorFn: asset =>
    asset.kind === 'image' ? 'Image' : asset.kind === 'geojson' ? 'Vector' : '',
  header: ({column}) => <DataTableColumnHeader column={column} title="Type" />,
  cell: ({getValue}) => getValue<string>() || '—',
};

const sizeColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'byteSize',
  header: ({column}) => <DataTableColumnHeader column={column} title="Size" />,
  cell: ({getValue}) => formatBytes(getValue<number>()),
};

const teamColumn: ColumnDef<ExistingMapAsset> = {
  id: 'team',
  accessorKey: 'ownedByTeamId',
  header: ({column}) => <DataTableColumnHeader column={column} title="Team" />,
  cell: ({row}) =>
    row.original.ownedByTeamId ? (
      <TeamCellComponent teamId={row.original.ownedByTeamId} />
    ) : (
      'Owned by me'
    ),
};

const updatedColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'updatedAt',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Updated" />
  ),
  cell: ({getValue}) => displayDateTime({timestamp: getValue<number>()}),
};

const descriptionColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'description',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Description" />
  ),
  cell: ({getValue}) => {
    const description = getValue<string>();
    if (!description) {
      return null;
    }
    return description.length > 80
      ? `${description.slice(0, 80)}…`
      : description;
  },
};

export function getMapLayerTableColumns(): ColumnDef<ExistingMapAsset>[] {
  return [
    nameColumn,
    statusColumn,
    typeColumn,
    sizeColumn,
    teamColumn,
    updatedColumn,
    descriptionColumn,
  ];
}
