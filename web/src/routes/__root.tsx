import {AuthContext} from '@/auth';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';

interface MyRouterContext {
  auth: AuthContext;
}

/**
 * Route component renders the main application layout with a sidebar.
 * It includes the main navigation and the main content.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
});
