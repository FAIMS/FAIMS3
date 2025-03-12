import {AuthContext} from '@/context/auth-provider';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';

export const Route = createRootRouteWithContext<{auth: AuthContext}>()({
  component: () => <Outlet />,
});
