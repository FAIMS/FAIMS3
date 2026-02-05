/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: App.tsx
 * Description:
 *   Main application entry point. Configures routing, theming, state management,
 *   and core providers for the FAIMS3 application.
 *
 *   This file uses React Router v6's Data Router API (createBrowserRouter) which
 *   enables advanced features like:
 *   - useBlocker for navigation blocking (used to flush pending form saves)
 *   - Loader/action patterns for data fetching
 *   - Built-in error boundaries per route
 *   - Pending navigation states via useNavigation
 */

// import '@capacitor-community/safe-area';
// import {SafeArea} from '@capacitor-community/safe-area';
import {StyledEngineProvider, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
  createBrowserRouter,
  Outlet,
  RouteObject,
  RouterProvider,
} from 'react-router-dom';
import './App.css';
import {OFFLINE_MAPS} from './buildconfig';
import {TolerantPrivateRoute} from './constants/privateRouter';
import * as ROUTES from './constants/routes';
import {getEditRecordRoute} from './constants/routes';
import {NotificationProvider} from './context/popup';
import {InitialiseGate, StateProvider} from './context/store';
import {AuthReturn} from './gui/components/authentication/auth_return';
import {MapDownload} from './gui/components/maps/MapDownload';
import MainLayout from './gui/layout';
import NotFound404 from './gui/pages/404';
import AboutBuild from './gui/pages/about-build';
import {EditRecordPage} from './gui/pages/editRecord';
import Notebook from './gui/pages/notebook';
import {PouchExplorer} from './gui/pages/pouchExplorer';
import {SignIn} from './gui/pages/signin';
import {ViewRecordPage} from './gui/pages/viewRecord';
import Workspace from './gui/pages/workspace';
import {theme} from './gui/themes';
import {AppUrlListener} from './native_hooks';

// =============================================================================
// REACT QUERY CONFIGURATION
// =============================================================================

/**
 * Global React Query client configuration.
 *
 * Provides sensible defaults for caching, retries, and refetching behaviour
 * across the application.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queries are enabled by default
      enabled: true,

      // Retry failed queries up to 3 times with exponential backoff
      retry: 3,

      // Consider data fresh for 30 seconds before background refetch
      staleTime: 30000,

      // Refetch when component mounts if data is stale
      refetchOnMount: true,

      // Don't refetch on window focus (can be noisy on mobile)
      refetchOnWindowFocus: false,

      // Refetch when network reconnects (important for offline-first)
      refetchOnReconnect: true,

      // Always default to running queries with network mode always - as most
      // queries are to Pouch - can be overridden for network only queries
      networkMode: 'always',
    },
    mutations: {
      // Don't retry mutations - let the user explicitly retry on failure
      retry: 0,
    },
  },
});

// =============================================================================
// ROUTE LAYOUT COMPONENTS
// =============================================================================

/**
 * Root layout component that wraps all routes.
 *
 * Provides:
 * - Deep link handling via AppUrlListener
 * - Main application layout (header, navigation, etc.)
 * - Outlet for nested route content
 *
 * This component must be inside the router context to allow AppUrlListener
 * to use navigation hooks.
 */
const RootLayout = () => {
  return (
    <>
      {/* Handle deep links and app URL schemes */}
      <AppUrlListener />

      {/* Main application chrome (header, sidebar, etc.) */}
      <MainLayout>
        {/* Nested route content renders here */}
        <Outlet />
      </MainLayout>
    </>
  );
};

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

/**
 * Application route configuration.
 *
 * Routes are organized into logical groups:
 * 1. Public routes (sign in, auth callback)
 * 2. Protected routes (workspace, notebooks, records)
 * 3. Utility routes (about, debug tools)
 * 4. Catch-all 404
 *
 * Protection is handled by wrapper components:
 * - TolerantPrivateRoute: Allows offline access with cached credentials
 * - ActivePrivateRoute: Requires active authentication
 * - OnlineOnlyRoute: Requires network connectivity
 */
const routes: RouteObject[] = [
  {
    // Root layout wraps all routes
    element: <RootLayout />,
    children: [
      // =========================================================================
      // PUBLIC ROUTES
      // =========================================================================
      {
        path: ROUTES.SIGN_IN,
        element: <SignIn />,
      },
      {
        path: ROUTES.AUTH_RETURN,
        element: <AuthReturn />,
      },

      // =========================================================================
      // PROTECTED ROUTES - WORKSPACE & NOTEBOOKS
      // =========================================================================
      {
        path: ROUTES.INDEX,
        element: (
          <TolerantPrivateRoute>
            <Workspace />
          </TolerantPrivateRoute>
        ),
      },
      {
        path: `${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}:serverId/:projectId`,
        element: (
          <TolerantPrivateRoute>
            <Notebook />
          </TolerantPrivateRoute>
        ),
      },

      // =========================================================================
      // PROTECTED ROUTES - RECORD MANAGEMENT
      // =========================================================================
      {
        // Edit an existing record
        path: getEditRecordRoute({
          serverId: ':serverId',
          projectId: ':projectId',
          recordId: ':recordId',
        }),
        element: (
          <TolerantPrivateRoute>
            <EditRecordPage />
          </TolerantPrivateRoute>
        ),
      },
      {
        // View a record (read-only)
        path: ROUTES.getViewRecordRoute({
          serverId: ':serverId',
          projectId: ':projectId',
          recordId: ':recordId',
        }),
        element: (
          <TolerantPrivateRoute>
            <ViewRecordPage />
          </TolerantPrivateRoute>
        ),
      },

      // =========================================================================
      // UTILITY ROUTES
      // =========================================================================
      {
        path: ROUTES.ABOUT_BUILD,
        element: <AboutBuild />,
      },
      // Offline maps route (conditionally included based on build config)
      ...(OFFLINE_MAPS
        ? [
            {
              path: ROUTES.OFFLINE_MAPS,
              element: <MapDownload />,
            },
          ]
        : []),
      {
        // Debug tool for inspecting PouchDB state
        path: ROUTES.POUCH_EXPLORER,
        element: <PouchExplorer />,
      },

      // =========================================================================
      // CATCH-ALL 404
      // =========================================================================
      {
        path: '*',
        element: <NotFound404 />,
      },
    ],
  },
];

/**
 * Create the data router instance.
 *
 * Using createBrowserRouter (Data Router API) instead of <BrowserRouter>
 * enables advanced features:
 *
 * - useBlocker: Block navigation and show confirmation or flush pending saves
 * - useNavigation: Access pending navigation state for loading indicators
 * - loader/action: Colocate data fetching with routes (future enhancement)
 * - errorElement: Per-route error boundaries (future enhancement)
 *
 * @see https://reactrouter.com/en/main/routers/create-browser-router
 */
const router = createBrowserRouter(routes);

// =============================================================================
// APPLICATION ROOT
// =============================================================================

/**
 * Main application component.
 *
 * Sets up the provider hierarchy:
 * 1. StateProvider - Global application state (auth, projects, etc.)
 * 2. InitialiseGate - Ensures app Redux store is initialised before rendering
 * 3. NotificationProvider - Toast/snackbar notifications
 * 4. QueryClientProvider - React Query for server state
 * 5. StyledEngineProvider - MUI style injection order
 * 6. ThemeProvider - MUI theme configuration
 * 7. RouterProvider - React Router with data router
 *
 * Note: Providers are ordered so that:
 * - State and initialisation happen first
 * - Notifications are available everywhere
 * - React Query is available in all routes
 * - Theming wraps all UI
 * - Router is innermost so routes can use all providers
 */
export default function App() {
  return (
    <StateProvider>
      <InitialiseGate>
        <NotificationProvider>
          <QueryClientProvider client={queryClient}>
            <StyledEngineProvider injectFirst>
              <ThemeProvider theme={theme}>
                <RouterProvider router={router} />
              </ThemeProvider>
            </StyledEngineProvider>
          </QueryClientProvider>
        </NotificationProvider>
      </InitialiseGate>
    </StateProvider>
  );
}
