import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/about')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello About!</div>;
}
