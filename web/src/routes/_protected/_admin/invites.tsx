import GlobalInvites from '@/components/tabs/admin/global-invites';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {createFileRoute} from '@tanstack/react-router';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/_admin/invites')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the global invites page
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/invites',
        label: 'Global Invites',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  return <GlobalInvites />;
}
