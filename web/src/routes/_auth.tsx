import {Outlet, createFileRoute, redirect} from '@tanstack/react-router';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {AppSidebar} from '@/components/side-bar/app-sidebar';
import {Separator} from '@/components/ui/separator';
import Breadcrumbs from '@/components/breadcrumbs';
import {ModeToggle} from '@/components/mode-toggle';
import {Dialog} from '@/components/ui/dialog';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({context, location}) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AuthLayout,
});

/**
 * AuthLayout component renders the main application layout with a sidebar.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered AuthLayout component.
 */
function AuthLayout() {
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
