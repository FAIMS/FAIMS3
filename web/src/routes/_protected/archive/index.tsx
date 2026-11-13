// SPDX-License-Identifier: Apache-2.0
import {
  ARCHIVE_TAB_LABELS,
  type ArchiveTab,
  getVisibleArchiveTabs,
  parseArchiveTab,
} from '@/archive/archive-tabs';
import {DataTable} from '@/components/data-table/data-table';
import {archivedDisabledUserColumns} from '@/components/tables/archived-disabled-users';
import {archivedTeamColumns} from '@/components/tables/archived-teams';
import {archivedTemplateColumns} from '@/components/tables/archived-templates';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {archivedProjectColumns} from '@/components/tables/archived-projects';
import {
  usePagedProjects,
  usePagedTeams,
  usePagedTemplates,
  usePagedUsers,
} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {createFileRoute, Navigate, useNavigate} from '@tanstack/react-router';
import {Action} from '@faims3/data-model';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/archive/')({
  validateSearch: (search: Record<string, unknown>): {tab: ArchiveTab} => ({
    tab: parseArchiveTab(search),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();
  const navigate = useNavigate();
  const {tab} = Route.useSearch();

  const canSeeProjects = useIsAuthorisedTo({action: Action.LIST_PROJECTS});
  const canSeeTemplates = useIsAuthorisedTo({action: Action.LIST_TEMPLATES});
  const canSeeUsers = useIsAuthorisedTo({action: Action.VIEW_USER_LIST});
  // Same visibility as /teams: anyone who can list teams (filtered per resource).
  const canSeeTeams = true;

  const visibleArchiveTabs = useMemo(
    () =>
      getVisibleArchiveTabs({
        canSeeProjects,
        canSeeTemplates,
        canSeeTeams,
        canSeeUsers,
      }),
    [canSeeProjects, canSeeTemplates, canSeeTeams, canSeeUsers]
  );

  const paths = useMemo(
    () => [
      {
        path: '/archive',
        label: 'Archive',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  // Each tab asks the API for its archived rows only and pages through them.
  const archivedTemplates = usePagedTemplates({
    user,
    includeArchived: true,
    enabled: !!user && canSeeTemplates,
  });

  const archivedProjects = usePagedProjects({
    user,
    status: 'archived',
    enabled: !!user && canSeeProjects,
  });

  const archivedTeams = usePagedTeams({
    user,
    includeArchived: true,
    enabled: !!user && canSeeTeams,
  });

  const disabledUsers = usePagedUsers({
    user,
    includeArchived: true,
    enabled: !!user && canSeeUsers,
  });

  const setTab = (value: string) => {
    if (!visibleArchiveTabs.includes(value as ArchiveTab)) return;
    void navigate({
      to: '/archive',
      search: {tab: value as ArchiveTab},
    });
  };

  if (visibleArchiveTabs.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (!visibleArchiveTabs.includes(tab)) {
    return (
      <Navigate to="/archive" search={{tab: visibleArchiveTabs[0]}} replace />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>

      <Tabs
        value={tab}
        className="w-full"
        onValueChange={v => {
          if (v) setTab(v);
        }}
      >
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap justify-start gap-1">
          {visibleArchiveTabs.map(t => (
            <TabsTrigger key={t} value={t}>
              {ARCHIVE_TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        {canSeeProjects && (
          <TabsContent value={config.notebookNamePlural} className="mt-4">
            <DataTable
              columns={archivedProjectColumns}
              data={archivedProjects.notebooks}
              loading={archivedProjects.tableLoading}
              defaultRowsPerPage={archivedProjects.pageSize}
              serverPagination={archivedProjects.serverPagination}
            />
          </TabsContent>
        )}

        {canSeeTemplates && (
          <TabsContent value="templates" className="mt-4">
            <DataTable
              columns={archivedTemplateColumns}
              data={archivedTemplates.templates}
              loading={archivedTemplates.tableLoading}
              defaultRowsPerPage={archivedTemplates.pageSize}
              serverPagination={archivedTemplates.serverPagination}
            />
          </TabsContent>
        )}

        {canSeeTeams && (
          <TabsContent value="teams" className="mt-4">
            <DataTable
              columns={archivedTeamColumns}
              data={archivedTeams.teams}
              loading={archivedTeams.tableLoading}
              defaultRowsPerPage={archivedTeams.pageSize}
              serverPagination={archivedTeams.serverPagination}
            />
          </TabsContent>
        )}

        {canSeeUsers && (
          <TabsContent value="users" className="mt-4">
            <div className="rounded-md border bg-card p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Disabled accounts cannot sign in;{' '}
                {config.notebookNameCapitalized} and record history is
                unchanged. Use Re-enable to restore access.
              </p>
              <DataTable
                columns={archivedDisabledUserColumns}
                data={disabledUsers.users}
                loading={disabledUsers.tableLoading}
                defaultRowsPerPage={disabledUsers.pageSize}
                serverPagination={disabledUsers.serverPagination}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
