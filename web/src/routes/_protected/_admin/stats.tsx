// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {Alert, AlertDescription} from '@/components/ui/alert';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {
  useGetAdminStats,
  useGetAdminStatsPeople,
  useGetAdminStatsTeams,
  useRefreshAdminStats,
} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {displayIsoTimestamp} from '@/lib/time';
import {
  Action,
  AdminStatsPersonRow,
  AdminStatsTeamRow,
  formatFileSize,
} from '@faims3/data-model';
import {ColumnDef, PaginationState} from '@tanstack/react-table';
import {createFileRoute} from '@tanstack/react-router';
import {AlertTriangle, RefreshCw} from 'lucide-react';
import {useMemo, useState} from 'react';

export const Route = createFileRoute('/_protected/_admin/stats')({
  component: StatsPage,
});

/** Default page size for the Teams and People tables. */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Format a numeric stat for display. Undefined (snapshot not yet loaded)
 * renders an em dash rather than `0`, so empty cards are not mistaken for
 * a real zero count.
 */
function formatCount(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toLocaleString();
}

/**
 * Storage totals use the same size-dependent units as map layers / project
 * details (`formatFileSize`). Undefined stays an em dash until the snapshot
 * arrives.
 */
function formatStorage(value: number | undefined): string {
  if (value === undefined) return '—';
  return formatFileSize(value);
}

/**
 * Control Centre Stats page: instance-wide usage counts overall, per team,
 * and per person. Queries run on landing; React Query keeps the snapshot until
 * `expiresAt` (or Refresh POSTs once and pages teams/people from the new cache).
 */
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
    enabled: canSeeStats,
  });
  const teamsQuery = useGetAdminStatsTeams({
    user,
    enabled: canSeeStats,
    limit: teamPagination.pageSize,
    offset: teamPagination.pageIndex * teamPagination.pageSize,
  });
  const peopleQuery = useGetAdminStatsPeople({
    user,
    enabled: canSeeStats,
    limit: peoplePagination.pageSize,
    offset: peoplePagination.pageIndex * peoplePagination.pageSize,
  });
  const refreshMutation = useRefreshAdminStats({user});

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
      {
        accessorKey: 'byteCount',
        header: `${config.notebookNameCapitalized} storage`,
        cell: ({getValue}) => formatStorage(getValue<number | undefined>()),
      },
      {
        accessorKey: 'mapAssetByteCount',
        header: 'Map layer storage',
        cell: ({getValue}) => formatStorage(getValue<number | undefined>()),
      },
    ],
    []
  );
  const peopleColumns = useMemo<ColumnDef<AdminStatsPersonRow, unknown>[]>(
    () => [
      {accessorKey: 'email', header: 'Email'},
      {accessorKey: 'userId', header: 'User ID'},
      {
        accessorKey: 'loggedIn',
        header: 'Logged in',
        cell: ({getValue}) => (getValue<boolean>() ? 'Yes' : 'No'),
      },
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

  const countCards: {
    label: string;
    value: number | undefined;
    format?: 'bytes';
  }[] = [
    {label: 'Teams', value: overall?.teamCount},
    {label: 'Users', value: overall?.userCount},
    {label: 'Logged in users', value: overall?.loggedInUserCount},
    {
      label: config.notebookNamePluralCapitalized,
      value: overall?.notebookCount,
    },
    {label: 'Templates', value: overall?.templateCount},
    {label: 'Map layers', value: overall?.mapAssetCount},
    {
      label: 'Map layer storage',
      value: overall?.mapAssetByteCount,
      format: 'bytes',
    },
    {label: 'Records', value: overall?.recordCount},
    {label: 'Attachments (including photos)', value: overall?.attachmentCount},
    {
      label: `${config.notebookNameCapitalized} storage`,
      value: overall?.byteCount,
      format: 'bytes',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
          {overall?.generatedAt ? (
            <time
              className="text-sm text-muted-foreground"
              data-testid="web-stats-generated-at"
              dateTime={overall.generatedAt}
            >
              Generated {displayIsoTimestamp(overall.generatedAt)}
            </time>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="web-stats-refresh"
            variant="outline"
            disabled={refreshMutation.isPending || statsQuery.isPending}
            onClick={() => refreshMutation.mutate()}
          >
            <RefreshCw
              className={refreshMutation.isPending ? 'animate-spin' : undefined}
            />
            {refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {overall?.incomplete ? (
        <Alert variant="warning" data-testid="web-stats-incomplete">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Some {config.notebookNamePlural} could not be scanned; counts may be
            incomplete.
          </AlertDescription>
        </Alert>
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
              {card.format === 'bytes'
                ? formatStorage(card.value)
                : formatCount(card.value)}
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Teams</h2>
        <DataTable
          testId="web-stats-teams-table"
          columns={teamColumns}
          data={teamsQuery.data?.teams ?? []}
          loading={teamsQuery.isPending}
          emptyMessage="No team rows in this snapshot."
          hideSearch
          manualPagination
          pageCount={Math.ceil(
            (teamsQuery.data?.total ?? 0) / teamPagination.pageSize
          )}
          pagination={teamPagination}
          onPaginationChange={setTeamPagination}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">People</h2>
        <DataTable
          testId="web-stats-people-table"
          columns={peopleColumns}
          data={peopleQuery.data?.people ?? []}
          loading={peopleQuery.isPending}
          emptyMessage="No people with records, attachments, or an active session in this snapshot."
          hideSearch
          manualPagination
          pageCount={Math.ceil(
            (peopleQuery.data?.total ?? 0) / peoplePagination.pageSize
          )}
          pagination={peoplePagination}
          onPaginationChange={setPeoplePagination}
        />
      </section>
    </div>
  );
}
