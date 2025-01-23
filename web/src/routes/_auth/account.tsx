import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/account')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the account page.
 * It displays a card with the account information.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  return <Card>Account</Card>;
}
