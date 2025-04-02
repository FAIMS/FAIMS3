import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/teams';
import {useAuth} from '@/context/auth-provider';
import {useGetTeams} from '@/hooks/get-hooks';
import {createFileRoute, useNavigate} from '@tanstack/react-router';

import {CreateTeamDialog} from '@/components/dialogs/create-team-dialog';

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

  const {isPending, data} = useGetTeams(user);

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      // TODO work out why this is broken ts?
      // @ts-ignore
      data={data?.teams}
      loading={isPending}
      // @ts-ignore
      onRowClick={({_id}) => navigate({to: `/teams/${_id}`})}
      button={<CreateTeamDialog />}
    />
  );
}
