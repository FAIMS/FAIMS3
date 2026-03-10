import {useState, useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {GetNotebookListResponse} from '@faims3/data-model';
import {useAuth} from './auth-context';
import {fetchProjects} from './api-client';
import {getDashboardProjectContextValue} from './context/dashboard-project-context';
import type {DashboardProjectRuntime} from './dashboard-db';

type ProjectListItem = GetNotebookListResponse[number];

type ProjectsPanelProps = {
  onOpenProject: (projectId: string) => void;
};

export function ProjectsPanel({onOpenProject}: ProjectsPanelProps) {
  const {user, isAuthenticated, isExpired} = useAuth();
  const ctx = useMemo(() => getDashboardProjectContextValue(), []);
  const [activeRuntime, setActiveRuntime] =
    useState<DashboardProjectRuntime | null>(null);
  const [latestStats, setLatestStats] = useState<{
    projectId: string;
    recordCount: number;
  } | null>(null);

  const enabled = !!user && isAuthenticated && !isExpired();

  const projectsQuery = useQuery({
    queryKey: ['dashboard-projects', user?.token],
    queryFn: async () => {
      if (!user) throw new Error('No user');
      return await fetchProjects(user);
    },
    enabled,
  });

  // Whenever we activate a project, hook a debounced live listener for stats
  useEffect(() => {
    if (!activeRuntime) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const {engine, projectId} = activeRuntime;

    const triggerStatsRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (cancelled) return;
        try {
          const result = await engine.query.getRecords({limit: 10000});
          if (!cancelled) {
            setLatestStats({
              projectId,
              recordCount: result.records.length,
            });
          }
        } catch (e) {
          // swallow for prototype
          // eslint-disable-next-line no-console
          console.error('Failed to refresh dashboard stats', e);
        }
      }, 500);
    };

    // Initial load
    triggerStatsRefresh();

    // Live changes subscription on local DB
    const changesFeed = (engine.db as any).changes?.({
      live: true,
      include_docs: false,
      since: 'now',
    });

    if (changesFeed && typeof changesFeed.on === 'function') {
      changesFeed.on('change', triggerStatsRefresh);
      changesFeed.on('error', (err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Dashboard local changes feed error', err);
      });
    }

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (changesFeed && typeof changesFeed.cancel === 'function') {
        changesFeed.cancel();
      }
    };
  }, [activeRuntime]);

  const handleActivateProject = async (project: ProjectListItem) => {
    if (!user) return;
    const runtime = await ctx.getOrCreateRuntime(project.project_id, user);
    setActiveRuntime(runtime);
  };

  const handleOpenProject = async (project: ProjectListItem) => {
    if (!user) return;
    await ctx.getOrCreateRuntime(project.project_id, user);
    onOpenProject(project.project_id);
  };

  const activeProjectId = activeRuntime?.projectId;
  const projects = projectsQuery.data ?? [];

  const statsText = useMemo(() => {
    if (!latestStats || !activeProjectId) return 'No stats yet.';
    if (latestStats.projectId !== activeProjectId) return 'Loading stats…';
    return `${latestStats.recordCount} records (live)`;
  }, [latestStats, activeProjectId]);

  if (!enabled) {
    return (
      <section className="mt-8 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        Sign in to see available projects.
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-md border border-border bg-card p-4 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        {projectsQuery.isFetching && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
      </header>

      {projectsQuery.isError && (
        <p className="text-sm text-destructive">
          Failed to load projects: {(projectsQuery.error as Error).message}
        </p>
      )}

      {!projectsQuery.isLoading && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No projects available for this user.
        </p>
      )}

      {projects.length > 0 && (
        <ul className="space-y-2 text-sm">
          {projects.map(project => (
            <li
              key={project.project_id}
              className="flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-muted-foreground">
                  {project.project_id}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                  onClick={() => void handleActivateProject(project)}
                >
                  {activeProjectId === project.project_id
                    ? 'Rebuild dashboard'
                    : 'Activate dashboard'}
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                  onClick={() => void handleOpenProject(project)}
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeProjectId && (
        <div className="mt-4 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">
            Active project: {activeProjectId}
          </div>
          <div>{statsText}</div>
        </div>
      )}
    </section>
  );
}
