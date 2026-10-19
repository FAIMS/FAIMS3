// SPDX-License-Identifier: Apache-2.0
import {DataTableColumnHeader} from '@/components/data-table/column-header';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Badge} from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {cn} from '@/lib/utils';
import {displayDateTime} from '@/lib/time';
import {
  formatFileSize,
  isMapAssetInProgress,
  mapAssetKindLabel,
  mapAssetProcessingStatusText,
  type ExistingMapAsset,
} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {useLayoutEffect, useRef, useState} from 'react';

/**
 * Single-line ellipsis. Names are narrower than descriptions; both use the
 * same truncation so the ellipsis shows in the same way.
 */
function TruncatedListingText({
  text,
  widthClass,
}: {
  text: string | undefined;
  widthClass: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const measure = () => {
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, widthClass]);

  if (!text) {
    return null;
  }

  const className = cn(
    'block truncate',
    widthClass,
    overflowing && 'cursor-help'
  );
  const content = (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
  if (!overflowing) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function statusLabel(asset: ExistingMapAsset): string {
  switch (asset.status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Failed';
    case 'ready':
      return 'Ready';
  }
}

const nameColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'name',
  header: ({column}) => <DataTableColumnHeader column={column} title="Name" />,
  meta: {cellClassName: 'w-72 max-w-72 pr-8', headerClassName: 'w-72'},
  cell: ({getValue}) => (
    <TruncatedListingText
      text={getValue<string | undefined>()}
      widthClass="w-full"
    />
  ),
};

const statusColumn: ColumnDef<ExistingMapAsset> = {
  id: 'status',
  accessorFn: statusLabel,
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Status" />
  ),
  cell: ({row}) => {
    const asset = row.original;
    const label = statusLabel(asset);
    const progress = isMapAssetInProgress(asset.status)
      ? mapAssetProcessingStatusText(asset)
      : undefined;
    const variant =
      asset.status === 'failed'
        ? 'destructive'
        : asset.status === 'ready'
          ? 'secondary'
          : 'outline';
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={variant} className="w-fit">
          {label}
        </Badge>
        {progress ? (
          <span className="text-xs text-muted-foreground">{progress}</span>
        ) : null}
      </div>
    );
  },
};

const typeColumn: ColumnDef<ExistingMapAsset> = {
  id: 'kind',
  accessorFn: asset => mapAssetKindLabel(asset.kind),
  header: ({column}) => <DataTableColumnHeader column={column} title="Type" />,
  cell: ({getValue}) => getValue<string>() || '—',
};

const sizeColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'byteSize',
  header: ({column}) => <DataTableColumnHeader column={column} title="Size" />,
  cell: ({getValue}) => {
    const bytes = getValue<number>();
    return bytes > 0 ? formatFileSize(bytes) : '—';
  },
};

const teamColumn: ColumnDef<ExistingMapAsset> = {
  id: 'team',
  accessorKey: 'ownedByTeamId',
  header: ({column}) => <DataTableColumnHeader column={column} title="Team" />,
  cell: ({row}) =>
    row.original.ownedByTeamId ? (
      <TeamCellComponent teamId={row.original.ownedByTeamId} />
    ) : (
      '-'
    ),
};

const ownerColumn: ColumnDef<ExistingMapAsset> = {
  accessorKey: 'createdBy',
  header: ({column}) => <DataTableColumnHeader column={column} title="Owner" />,
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
  meta: {cellClassName: 'w-72 max-w-72', headerClassName: 'w-72'},
  cell: ({getValue}) => (
    <TruncatedListingText
      text={getValue<string | undefined>()}
      widthClass="w-72"
    />
  ),
};

export function getMapLayerTableColumns(options?: {
  hideTeamColumn?: boolean;
}): ColumnDef<ExistingMapAsset>[] {
  return [
    nameColumn,
    statusColumn,
    typeColumn,
    sizeColumn,
    ...(options?.hideTeamColumn ? [] : [teamColumn]),
    ownerColumn,
    updatedColumn,
    descriptionColumn,
  ];
}
