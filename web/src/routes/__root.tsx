import {AuthContext} from '@/auth';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';

interface MyRouterContext {
  auth: AuthContext;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => <Outlet />,
});
