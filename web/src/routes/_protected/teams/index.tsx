import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/teams';
import {useGetTeams} from '@/hooks/queries';
import {createFileRoute, useNavigate, useRouter} from '@tanstack/react-router';

import {CreateTeamDialog} from '@/components/dialogs/teams/create-team-dialog';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action} from '@faims3/data-model';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/teams/')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the projects page.
 * It displays a table with the user's projects.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const user = useRequiredUser();
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/teams',
        label: 'Teams',
      },
    ],
    [pathname]
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  // Can the user create a new team?
  const canCreateTeam = useIsAuthorisedTo({action: Action.CREATE_TEAM});
  const {isPending, data} = useGetTeams({user});
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <h1
        className="text-2xl font-semibold tracking-tight"
        data-testid="web-teams-heading"
      >
        Teams
      </h1>
      <DataTable
        columns={columns}
        data={data ? data?.teams : []}
        loading={isPending}
        onRowClick={({_id}) => navigate({to: `/teams/${_id}`})}
        button={canCreateTeam && <CreateTeamDialog />}
      />
    </div>
  );
}
