import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the home page.
 * It displays a card with the home page content.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  return <Card>Home</Card>;
}
