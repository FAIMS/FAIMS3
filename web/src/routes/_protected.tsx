import Breadcrumbs from '@/components/breadcrumbs';
import {ModeToggle} from '@/components/mode-toggle';
import {AppSidebar} from '@/components/side-bar/app-sidebar';
import {Dialog} from '@/components/ui/dialog';
import {Separator} from '@/components/ui/separator';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {useAuth} from '@/context/auth-provider';
import {createFileRoute, Outlet} from '@tanstack/react-router';

interface TokenParams {
  token?: string;
  refreshToken?: string;
}

/**
 * Route component renders the protected route with a sidebar.
 * It displays the sidebar with the user's profile and logout button.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected')({
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
    if (isAuthenticated) return;

    const {status} = await getUserDetails(token, refreshToken);

    if (status === 'success') return;

    window.location.href = `${
      import.meta.env.VITE_API_URL
    }/auth?redirect=${import.meta.env.VITE_WEB_URL}`;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const auth = useAuth();

  if (!auth.user) return <></>;

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
