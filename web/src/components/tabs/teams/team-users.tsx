import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/teamUsers';
import {useAuth} from '@/context/auth-provider';
import {useGetUsersForTeam} from '@/hooks/get-hooks';
import {ErrorComponent} from '@tanstack/react-router';

const TeamUsers = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  if (!user) {
    return <ErrorComponent error="Unauthenticated" />;
  }

  const {isPending, data} = useGetUsersForTeam({user, teamId});

  return (
    <DataTable columns={columns} data={data?.members} loading={isPending} />
  );
};

export default TeamUsers;
