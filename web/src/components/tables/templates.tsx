import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {cn} from '@/lib/utils';
import {displayDateTime} from '@/lib/time';
import {TeamCellComponent} from './cells/team-cell';
import type {TemplateApiListItem} from '@faims3/data-model';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export type Column = TemplateApiListItem;

const nameColumn: ColumnDef<Column> = {
  accessorKey: 'name',
  header: ({column}) => <DataTableColumnHeader column={column} title="Name" />,
};

const teamColumn: ColumnDef<Column> = {
  id: 'team',
  accessorKey: 'ownedByTeamId',
  header: ({column}) => <DataTableColumnHeader column={column} title="Team" />,
  cell: ({
    row: {
      original: {ownedByTeamId, ownedByTeamDisplayName},
    },
  }) => {
    return ownedByTeamId ? (
      <TeamCellComponent
        teamId={ownedByTeamId}
        teamDisplayName={ownedByTeamDisplayName}
      />
    ) : null;
  },
};

const statusColumn: ColumnDef<Column> = {
  id: 'status',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Status" />
  ),
  accessorFn: (row: Column & {archived?: boolean}) =>
    row.archived === true ? 'Archived' : 'Active',
  cell: ({row}: {row: {original: Column & {archived?: boolean}}}) => {
    const label = row.original.archived === true ? 'Archived' : 'Active';
    return <RoleCard>{label}</RoleCard>;
  },
};

const visibilityColumn: ColumnDef<Column> = {
  id: 'visibility',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Visibility" />
  ),
  accessorFn: (row: Column & {isPublic?: boolean}) =>
    row.isPublic === true ? 'Public' : 'Private',
  cell: ({row}: {row: {original: Column & {isPublic?: boolean}}}) => {
    const isPublic = row.original.isPublic === true;
    const label = isPublic ? 'Public' : 'Private';
    return (
      <RoleCard
        className={cn(
          isPublic &&
            'border border-accented-row/25 bg-accented-row/[0.12] text-accented-row dark:border-accented-row/35 dark:bg-accented-row/[0.18] dark:text-accented-row'
        )}
      >
        {label}
      </RoleCard>
    );
  },
};

const createdByColumn: ColumnDef<Column> = {
  accessorKey: 'createdBy',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Created by" />
  ),
};

const createdAtColumn: ColumnDef<Column> = {
  accessorKey: 'createdAt',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Created" />
  ),
  cell: ({getValue}) => {
    const v = getValue<string | undefined>();
    return v ? displayDateTime({timestamp: new Date(v).getTime()}) : null;
  },
};

const descriptionColumn: ColumnDef<Column> = {
  accessorKey: 'description',
  header: ({column}) => (
    <DataTableColumnHeader column={column} title="Description" />
  ),
  cell: ({getValue}) => {
    const description = getValue<string>();
    if (!description) return null;
    const maxLength = 100;
    const isTruncated = description.length > maxLength;
    const displayText = isTruncated
      ? description.slice(0, maxLength) + '…'
      : description;

    if (!isTruncated) return <span>{displayText}</span>;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{displayText}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
};

/**
 * Columns for the templates overview table. Visibility is omitted unless the
 * user has global permission to change catalogue visibility (ops/system admin).
 */
export function getTemplatesTableColumns(options: {
  includeVisibility: boolean;
  /** When true, omit the team column (e.g. team tab where team is fixed). */
  hideTeamColumn?: boolean;
}): ColumnDef<Column>[] {
  const {includeVisibility, hideTeamColumn} = options;
  const team = hideTeamColumn ? [] : [teamColumn];
  const visibility = includeVisibility ? [visibilityColumn] : [];
  return [
    nameColumn,
    ...team,
    statusColumn,
    ...visibility,
    createdByColumn,
    createdAtColumn,
    descriptionColumn,
  ];
}
