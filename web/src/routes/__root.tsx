import {AuthContext, useAuth} from '@/context/auth-provider';
import Breadcrumbs from '@/components/breadcrumbs';
import {ModeToggle} from '@/components/mode-toggle';
import {AppSidebar} from '@/components/side-bar/app-sidebar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {Dialog} from '@radix-ui/react-dialog';
import {Separator} from '@radix-ui/react-separator';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';

interface MyRouterContext {
  auth: AuthContext;
}

interface TokenParams {
  token?: string;
  refreshToken?: string;
}

const EXCLUDED_PUBLIC_ROUTES = ['/auth/resetPassword'];

/**
 * Route component renders the main application layout with a sidebar.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createRootRouteWithContext<MyRouterContext>()({
  validateSearch: (search: Record<string, string>): TokenParams => ({
    token: search.token,
    refreshToken: search.refreshToken,
  }),
  beforeLoad: async ({
    context: {
      auth: {isAuthenticated, getUserDetails},
    },
    search: {token, refreshToken},
  }) => {
    if (EXCLUDED_PUBLIC_ROUTES.some(r => window.location.href.includes(r)))
      return;

    if (isAuthenticated) return;

    const {status} = await getUserDetails(token, refreshToken);

    if (status === 'success') return;

    window.location.href = `${
      import.meta.env.VITE_API_URL
    }/auth?redirect=${import.meta.env.VITE_WEB_URL}`;
  },
  component: RootLayout,
});

/**
 * RootLayout component renders the main application layout with a sidebar.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered AuthLayout component.
 */
function RootLayout() {
  const {isAuthenticated} = useAuth();

  // Exclusions
  if (!EXCLUDED_PUBLIC_ROUTES.some(r => window.location.href.includes(r))) {
    if (!isAuthenticated) {
      window.location.href = `${
        import.meta.env.VITE_API_URL
      }/logout?redirect=${import.meta.env.VITE_WEB_URL}`;

      return <></>;
    }
  }

  return (
    <Dialog>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumbs />
              </div>
              <ModeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Dialog>
  );
}
