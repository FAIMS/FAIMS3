import {StrictMode, useEffect, useState} from 'react';
import ReactDOM from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {initialiseMaps, MapConfig} from '@faims3/forms';
import {ProjectUIModel} from '@faims3/data-model';
import './index.css';
import {AuthProvider, useAuth} from './auth-context';
import {DASHBOARD_TITLE} from './constants';
import {ProjectsPanel} from './projects-panel';
import {ProjectDetailView} from './views/ProjectDetailView';

type DashboardProps = {
  projectModel?: ProjectUIModel;
  mapConfig?: MapConfig;
};

function Dashboard({projectModel, mapConfig}: DashboardProps) {
  const {isAuthenticated, login, logout, user, isExpired} = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  useEffect(() => {
    document.title = DASHBOARD_TITLE;
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-3 text-sm">
            {isAuthenticated && !isExpired() && user?.decodedToken ? (
              <>
                <span className="text-muted-foreground">
                  Signed in as{' '}
                  <span className="font-medium">
                    {user.decodedToken.username}
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                  onClick={() => {
                    void logout();
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                onClick={login}
              >
                Sign in to Conductor
              </button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">
          This is a scaffold for the dashboard project. It is wired to use the
          shared data model and forms modules from the monorepo so you can start
          building dashboard views backed by real FAIMS data.
        </p>
        {projectModel && (
          <pre className="rounded-md border border-border bg-card p-4 text-sm">
            <code>{JSON.stringify(projectModel, null, 2)}</code>
          </pre>
        )}
        {mapConfig && (
          <pre className="rounded-md border border-border bg-card p-4 text-sm">
            <code>{JSON.stringify(mapConfig, null, 2)}</code>
          </pre>
        )}
        {currentProjectId ? (
          <ProjectDetailView
            projectId={currentProjectId}
            onBack={() => setCurrentProjectId(null)}
          />
        ) : (
          <ProjectsPanel onOpenProject={setCurrentProjectId} />
        )}
      </section>
    </main>
  );
}

initialiseMaps();

const queryClient = new QueryClient();
const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
