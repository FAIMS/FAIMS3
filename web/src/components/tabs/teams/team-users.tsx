import {DataTable} from '@/components/data-table/data-table';
import {AddTeamUserDialog} from '@/components/dialogs/teams/add-team-user-dialog';
import {getColumns} from '@/components/tables/team-users';
import {useAuth} from '@/context/auth-provider';
import {useGetUsersForTeam} from '@/hooks/get-hooks';
import {ErrorComponent} from '@tanstack/react-router';
import {LoaderCircle, Plus} from 'lucide-react';
import {useMemo} from 'react';

const TeamUsers = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  if (!user) {
    return <ErrorComponent error="Unauthenticated" />;
  }

  const {isLoading, data} = useGetUsersForTeam({user, teamId});
  const columns = useMemo(() => getColumns({teamId}), [teamId]);

  return (
    <div>
      {isLoading ? (
        <LoaderCircle />
      ) : (
        <DataTable
          columns={columns}
          data={data?.members || []}
          loading={isLoading}
          button={
            <AddTeamUserDialog
              teamId={teamId}
              buttonContent={
                <>
                  <Plus />
                  {'Add user'}
                </>
              }
            />
          }
        />
      )}
    </div>
  );
};

export default TeamUsers;
