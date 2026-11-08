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
import {
  Action,
  AdminStatsPersonRow,
  AdminStatsTeamRow,
} from '@faims3/data-model';
import {ColumnDef, PaginationState} from '@tanstack/react-table';
import {createFileRoute} from '@tanstack/react-router';
import {AlertTriangle} from 'lucide-react';
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
 * Control Centre Stats page: instance-wide usage counts overall, per team,
 * and per person. Fetch is opt-in (Load) so opening the page does not scan
 * every data DB; Refresh POSTs once then pages teams/people from the new cache.
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

  // Queries stay disabled until Load; opening /stats must not scan CouchDB.
  const [hasLoaded, setHasLoaded] = useState(false);
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
  });
  const teamsQuery = useGetAdminStatsTeams({
    user,
    enabled: hasLoaded && canSeeStats,
    limit: teamPagination.pageSize,
    offset: teamPagination.pageIndex * teamPagination.pageSize,
  });
  const peopleQuery = useGetAdminStatsPeople({
    user,
    enabled: hasLoaded && canSeeStats,
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
  const listsLoading = refreshMutation.isPending;

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
              onClick={() => setHasLoaded(true)}
            >
              Load
            </Button>
          ) : (
            <Button
              data-testid="web-stats-refresh"
              variant="outline"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
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
            <Alert variant="warning" data-testid="web-stats-incomplete">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Some {config.notebookNamePlural} could not be scanned; counts
                may be incomplete.
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
                  {formatCount(card.value)}
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
              loading={teamsQuery.isPending || listsLoading}
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
              loading={peopleQuery.isPending || listsLoading}
              emptyMessage="No people with records or attachments in this snapshot."
              hideSearch
              manualPagination
              pageCount={Math.ceil(
                (peopleQuery.data?.total ?? 0) / peoplePagination.pageSize
              )}
              pagination={peoplePagination}
              onPaginationChange={setPeoplePagination}
            />
          </section>
        </>
      )}
    </div>
  );
}
