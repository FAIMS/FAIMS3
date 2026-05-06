import {createFileRoute, Outlet} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/_admin')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
