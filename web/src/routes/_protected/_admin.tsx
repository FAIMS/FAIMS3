// SPDX-License-Identifier: Apache-2.0
import {createFileRoute, Outlet} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/_admin')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
