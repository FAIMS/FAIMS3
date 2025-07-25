import {webUserHasGlobalRole} from '@/hooks/auth-hooks';
import {Role} from '@faims3/data-model';
import {createFileRoute, Outlet, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/_admin')({
  component: RouteComponent,
  beforeLoad: async ({
    context: {
      auth: {user},
    },
  }) => {
    if (user && !webUserHasGlobalRole({user, role: Role.GENERAL_ADMIN}))
      throw redirect({to: '/'});
  },
});

function RouteComponent() {
  return <Outlet />;
}
