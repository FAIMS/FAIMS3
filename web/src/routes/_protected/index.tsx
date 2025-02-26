import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div></div>;
}
