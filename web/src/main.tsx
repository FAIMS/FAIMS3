import {Toaster} from '@/components/ui/sonner';
import {ThemeProvider} from '@/context/theme-provider';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RouterProvider, createRouter} from '@tanstack/react-router';
import React, {StrictMode, useEffect} from 'react';
import ReactDOM from 'react-dom/client';
import {APP_VERSION, BUGSNAG_API_KEY, WEBSITE_TITLE} from './constants';
import {AuthProvider, useAuth} from './context/auth-provider';
import {BreadcrumbProvider} from './context/breadcrumb-provider';
import './index.css';
import {routeTree} from './routeTree.gen';
import {getThemeClass} from './lib/theme';
import {initialiseMaps} from '@faims3/forms';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import {ErrorFallback} from './components/ErrorFallback';

// Initialize Bugsnag if API key is configured
const bugsnagEnabled = BUGSNAG_API_KEY !== undefined;

if (bugsnagEnabled) {
  Bugsnag.start({
    apiKey: BUGSNAG_API_KEY!,
    plugins: [new BugsnagPluginReact()],
    appVersion: APP_VERSION,
  });
} else {
  console.warn('BUGSNAG_API_KEY not set, error reporting disabled');
}

// Create ErrorBoundary component (or passthrough if Bugsnag disabled)
const ErrorBoundary = bugsnagEnabled
  ? Bugsnag.getPlugin('react')!.createErrorBoundary(React)
  : ({children}: {children: React.ReactNode}) => <>{children}</>;

/**
 * App component renders the main application layout.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered App component.
 */
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    auth: undefined!,
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/* Initialise offline Map database */
initialiseMaps();

/**
 * App component renders the main application layout.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered App component.
 */
function App() {
  const auth = useAuth();

  // Set the website title
  useEffect(() => {
    document.title = WEBSITE_TITLE ?? 'Control Centre';
    document.documentElement.className = getThemeClass();
  }, []);

  // Sync user ID to Bugsnag for error correlation (no PII)
  useEffect(() => {
    if (bugsnagEnabled && auth.user?.user.id) {
      Bugsnag.setUser(auth.user.user.id);
    } else if (bugsnagEnabled) {
      Bugsnag.setUser(undefined);
    }
  }, [auth.user?.user.id]);
  return <RouterProvider router={router} context={{auth}} />;
}

const queryClient = new QueryClient();
const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary
        FallbackComponent={() => (
          <ErrorFallback bugsnagEnabled={bugsnagEnabled} />
        )}
      >
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <BreadcrumbProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <App />
                <Toaster />
              </QueryClientProvider>
            </AuthProvider>
          </BreadcrumbProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
