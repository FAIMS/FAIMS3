import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/teams';
import {useAuth} from '@/context/auth-provider';
import {useGetTeams} from '@/hooks/get-hooks';
import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {CreateTeamDialog} from '@/components/dialogs/teams/create-team-dialog';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

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
  const {user} = useAuth();

  if (!user) {
    return <p>No user!</p>;
  }

  // Can the user create a new team?
  const canCreateTeam = useIsAuthorisedTo({action: Action.CREATE_TEAM});

  const {isPending, data} = useGetTeams(user);

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data ? data?.teams : []}
      loading={isPending}
      onRowClick={({_id}) => navigate({to: `/teams/${_id}`})}
      button={canCreateTeam && <CreateTeamDialog />}
    />
  );
}
