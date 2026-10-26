// SPDX-License-Identifier: Apache-2.0
import {DataTableColumnHeader} from '@/components/data-table/column-header';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {
  MapLayerStatusCell,
  mapLayerStatusLabel,
} from '@/components/tables/map-layer-status';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {displayDateTime} from '@/lib/time';
import {cn} from '@/lib/utils';
import {
  formatFileSize,
  mapAssetKindLabel,
  mapAssetLinkCount,
  type MapAssetWithLinkCount,
} from '@faims3/data-model';
import {ColumnDef} from '@tanstack/react-table';
import {useLayoutEffect, useRef, useState} from 'react';

/**
 * Single-line ellipsis. Names use this so a long title still shows a
 * tooltip when it overflows.
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

const nameColumn: ColumnDef<MapAssetWithLinkCount> = {
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

const statusColumn: ColumnDef<MapAssetWithLinkCount> = {
  id: 'status',
  accessorFn: mapLayerStatusLabel,
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Status" />
  ),
  cell: ({row}) => <MapLayerStatusCell asset={row.original} />,
};

const linkedSurveysColumn: ColumnDef<MapAssetWithLinkCount> = {
  id: 'linkCount',
  accessorFn: mapAssetLinkCount,
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Linked" />
  ),
  cell: ({row}) => (
    <span data-testid="web-map-layers-link-count">
      {mapAssetLinkCount(row.original)}
    </span>
  ),
};

const typeColumn: ColumnDef<MapAssetWithLinkCount> = {
  id: 'kind',
  accessorFn: asset => mapAssetKindLabel(asset.kind),
  header: ({column}) => <DataTableColumnHeader column={column} title="Type" />,
  cell: ({getValue}) => getValue<string>() || '—',
};

const sizeColumn: ColumnDef<MapAssetWithLinkCount> = {
  accessorKey: 'byteSize',
  header: ({column}) => <DataTableColumnHeader column={column} title="Size" />,
  cell: ({getValue}) => {
    const bytes = getValue<number>();
    return bytes > 0 ? formatFileSize(bytes) : '—';
  },
};

const teamColumn: ColumnDef<MapAssetWithLinkCount> = {
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

const ownerColumn: ColumnDef<MapAssetWithLinkCount> = {
  accessorKey: 'createdBy',
  header: ({column}) => <DataTableColumnHeader column={column} title="Owner" />,
};

const updatedColumn: ColumnDef<MapAssetWithLinkCount> = {
  accessorKey: 'updatedAt',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Updated" />
  ),
  cell: ({getValue}) => displayDateTime({timestamp: getValue<number>()}),
};

/** Library/team/project map-layer columns; hide Team on a team tab. */
export function getMapLayerTableColumns(options?: {
  hideTeamColumn?: boolean;
}): ColumnDef<MapAssetWithLinkCount>[] {
  return [
    nameColumn,
    statusColumn,
    linkedSurveysColumn,
    typeColumn,
    sizeColumn,
    ...(options?.hideTeamColumn ? [] : [teamColumn]),
    ownerColumn,
    updatedColumn,
  ];
}
