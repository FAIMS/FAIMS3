import {StrictMode} from 'react';
import ReactDOM from 'react-dom/client';
import {RouterProvider, createRouter} from '@tanstack/react-router';
import {ThemeProvider} from '@/components/theme-provider';
import {routeTree} from './routeTree.gen';
import './index.css';
import {AuthProvider, useAuth} from './auth';

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

function App() {
  const auth = useAuth();

  return <RouterProvider router={router} context={{auth}} />;
}

const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
