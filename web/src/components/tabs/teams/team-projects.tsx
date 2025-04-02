import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';
import {columns} from '@/components/tables/projects';
import {useAuth} from '@/context/auth-provider';
import {useGetProjectsForTeam} from '@/hooks/get-hooks';
import {useNavigate} from '@tanstack/react-router';

const TeamProjects = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  const {isPending, data} = useGetProjectsForTeam({user, teamId});

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isPending}
      onRowClick={({project_id}) => navigate({to: `/projects/${project_id}`})}
      // TODO prepopulate with team Id
      button={<CreateProjectDialog />}
    />
  );
};

export default TeamProjects;
