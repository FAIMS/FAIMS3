import {StrictMode} from 'react';
import ReactDOM from 'react-dom/client';
import {RouterProvider, createRouter} from '@tanstack/react-router';
import {ThemeProvider} from '@/context/theme-provider';
import {routeTree} from './routeTree.gen';
import './index.css';
import {AuthProvider, useAuth} from './context/auth-provider';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from '@/components/ui/sonner';
import {BreadcrumbProvider} from './context/breadcrumb-provider';
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

/**
 * App component renders the main application layout.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered App component.
 */
function App() {
  const auth = useAuth();

  return <RouterProvider router={router} context={{auth}} />;
}

const queryClient = new QueryClient();

const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
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
    </StrictMode>
  );
}
