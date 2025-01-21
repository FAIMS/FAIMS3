import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Card>Home</Card>;
}
