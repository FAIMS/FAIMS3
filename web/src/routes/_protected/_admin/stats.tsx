// SPDX-License-Identifier: Apache-2.0
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {DataTablePagination} from '@/components/data-table/pagination';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {
  useGetAdminStats,
  useGetAdminStatsPeople,
  useGetAdminStatsTeams,
} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {
  Action,
  AdminStatsPersonRow,
  AdminStatsTeamRow,
} from '@faims3/data-model';
import {
  ColumnDef,
  getCoreRowModel,
  PaginationState,
  useReactTable,
} from '@tanstack/react-table';
import {createFileRoute} from '@tanstack/react-router';
import {useEffect, useMemo, useState} from 'react';

export const Route = createFileRoute('/_protected/_admin/stats')({
  component: StatsPage,
});

const DEFAULT_PAGE_SIZE = 10;

function formatCount(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toLocaleString();
}

function StatsPagedTable<TData>({
  columns,
  data,
  loading,
  pageCount,
  pagination,
  onPaginationChange,
  emptyMessage,
  testId,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void;
  emptyMessage: string;
  testId: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(pageCount, 1),
    onPaginationChange,
    state: {pagination},
  });

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {typeof header.column.columnDef.header === 'string'
                      ? header.column.columnDef.header
                      : header.column.id}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length}>Loading…</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {String(cell.getValue() ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>{emptyMessage}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}

export function StatsPage() {
  const user = useRequiredUser();
  const canSeeStats = useIsAuthorisedTo({action: Action.VIEW_SYSTEM_STATS});
  const paths = useMemo(
    () => [
      {
        path: '/stats',
        label: 'Stats',
      },
    ],
    []
  );
  useBreadcrumbUpdate({isLoading: false, paths});

  const [hasLoaded, setHasLoaded] = useState(false);
  const [bypassCache, setBypassCache] = useState(false);
  const [teamPagination, setTeamPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [peoplePagination, setPeoplePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const statsQuery = useGetAdminStats({
    user,
    enabled: hasLoaded && canSeeStats,
    refresh: bypassCache,
  });
  const teamsQuery = useGetAdminStatsTeams({
    user,
    enabled: hasLoaded && canSeeStats,
    limit: teamPagination.pageSize,
    offset: teamPagination.pageIndex * teamPagination.pageSize,
    refresh: bypassCache,
  });
  const peopleQuery = useGetAdminStatsPeople({
    user,
    enabled: hasLoaded && canSeeStats,
    limit: peoplePagination.pageSize,
    offset: peoplePagination.pageIndex * peoplePagination.pageSize,
    refresh: bypassCache,
  });

  useEffect(() => {
    if (bypassCache && statsQuery.isFetched && !statsQuery.isFetching) {
      setBypassCache(false);
    }
  }, [bypassCache, statsQuery.isFetched, statsQuery.isFetching]);

  const teamColumns = useMemo<ColumnDef<AdminStatsTeamRow, unknown>[]>(
    () => [
      {accessorKey: 'name', header: 'Team'},
      {
        accessorKey: 'notebookCount',
        header: config.notebookNamePluralCapitalized,
      },
      {accessorKey: 'recordCount', header: 'Records'},
      {
        accessorKey: 'attachmentCount',
        header: 'Attachments (including photos)',
      },
      {accessorKey: 'byteCount', header: 'Storage (bytes)'},
    ],
    []
  );
  const peopleColumns = useMemo<ColumnDef<AdminStatsPersonRow, unknown>[]>(
    () => [
      {accessorKey: 'email', header: 'Email'},
      {accessorKey: 'userId', header: 'User ID'},
      {accessorKey: 'recordCount', header: 'Records'},
      {
        accessorKey: 'attachmentCount',
        header: 'Attachments (including photos)',
      },
    ],
    []
  );

  if (!canSeeStats) {
    return <p>You do not have access to view this page.</p>;
  }

  const overall = statsQuery.data;

  const countCards: {label: string; value: number | undefined}[] = [
    {label: 'Teams', value: overall?.teamCount},
    {label: 'Users', value: overall?.userCount},
    {
      label: config.notebookNamePluralCapitalized,
      value: overall?.notebookCount,
    },
    {label: 'Templates', value: overall?.templateCount},
    {label: 'Map layers', value: overall?.mapAssetCount},
    {label: 'Records', value: overall?.recordCount},
    {label: 'Attachments (including photos)', value: overall?.attachmentCount},
    {label: 'Storage (bytes)', value: overall?.byteCount},
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <div className="flex gap-2">
          {!hasLoaded ? (
            <Button
              data-testid="web-stats-load"
              onClick={() => {
                setHasLoaded(true);
                setBypassCache(false);
              }}
            >
              Load
            </Button>
          ) : (
            <Button
              data-testid="web-stats-refresh"
              variant="outline"
              onClick={() => setBypassCache(true)}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {!hasLoaded ? (
        <p data-testid="web-stats-empty">
          Usage counts are not loaded automatically. Choose Load to compute a
          snapshot of attachments (including photos),{' '}
          {config.notebookNamePlural}, records, and other first-class entities.
        </p>
      ) : (
        <>
          {overall ? (
            <p data-testid="web-stats-cache-times">
              as of {overall.generatedAt}, cached until {overall.expiresAt}
            </p>
          ) : (
            <p data-testid="web-stats-loading">Loading snapshot…</p>
          )}

          {overall?.incomplete ? (
            <p data-testid="web-stats-incomplete">
              Some {config.notebookNamePlural} could not be scanned; counts may
              be incomplete.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {countCards.map(card => (
              <Card key={card.label}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-2xl font-semibold">
                  {formatCount(card.value)}
                </CardContent>
              </Card>
            ))}
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Teams</h2>
            <StatsPagedTable
              testId="web-stats-teams-table"
              columns={teamColumns}
              data={teamsQuery.data?.teams ?? []}
              loading={teamsQuery.isPending}
              pageCount={Math.ceil(
                (teamsQuery.data?.total ?? 0) / teamPagination.pageSize
              )}
              pagination={teamPagination}
              onPaginationChange={setTeamPagination}
              emptyMessage="No team rows in this snapshot."
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">People</h2>
            <StatsPagedTable
              testId="web-stats-people-table"
              columns={peopleColumns}
              data={peopleQuery.data?.people ?? []}
              loading={peopleQuery.isPending}
              pageCount={Math.ceil(
                (peopleQuery.data?.total ?? 0) / peoplePagination.pageSize
              )}
              pagination={peoplePagination}
              onPaginationChange={setPeoplePagination}
              emptyMessage="No people with records or attachments in this snapshot."
            />
          </section>
        </>
      )}
    </div>
  );
}
