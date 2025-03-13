import {createFileRoute, Outlet, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/_admin')({
  component: RouteComponent,
  beforeLoad: async ({
    context: {
      auth: {user},
    },
  }) => {
    if (!user?.user.cluster_admin) throw redirect({to: '/'});
  },
});

function RouteComponent() {
  return <Outlet />;
}
