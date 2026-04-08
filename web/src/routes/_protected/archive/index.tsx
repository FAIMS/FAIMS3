import {
  ARCHIVE_TAB_VALUES,
  type ArchiveTab,
  parseArchiveTab,
} from '@/archive/archive-tabs';
import {DataTable} from '@/components/data-table/data-table';
import {archivedTemplateColumns} from '@/components/tables/archived-templates';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {archivedProjectColumns} from '@/components/tables/archived-projects';
import {useGetProjects, useGetTemplates} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {ProjectStatus} from '@faims3/data-model';
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

  const {isPending, data} = useGetTemplates({
    user,
    includeArchived: true,
    enabled: !!user,
  });

  const {
    isPending: projectsLoading,
    data: projectsData,
  } = useGetProjects({
    user,
    includeArchived: true,
    enabled: !!user,
  });

  const archivedSurveys = useMemo(
    () =>
      (projectsData ?? []).filter(
        p => p.status === ProjectStatus.ARCHIVED
      ),
    [projectsData]
  );

  const setTab = (value: string) => {
    if (!ARCHIVE_TAB_VALUES.includes(value as ArchiveTab)) return;
    void navigate({
      to: '/archive',
      search: {tab: value as ArchiveTab},
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resources which have been archived are visible below. Archived items
          can be restored or deleted. Please proceed with caution as deletion
          operations may be irreversible.
        </p>
      </div>

      <Tabs
        value={tab}
        className="w-full"
        onValueChange={v => {
          if (v) setTab(v);
        }}
      >
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="surveys">
            {NOTEBOOK_NAME_CAPITALIZED}s
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="surveys" className="mt-4">
          <DataTable
            columns={archivedProjectColumns}
            data={archivedSurveys}
            loading={projectsLoading}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <DataTable
            columns={archivedTemplateColumns}
            data={data}
            loading={isPending}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <PlaceholderArchivePanel
            title="Archived users"
            description="User archive listing will appear here. Restored users may need to be re-invited."
          />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <PlaceholderArchivePanel
            title="Archived teams"
            description="Team archive listing will appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderArchivePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm mt-2">{description}</p>
    </div>
  );
}
