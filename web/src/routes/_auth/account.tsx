import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/account')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Card>Account</Card>;
}
