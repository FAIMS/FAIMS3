import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';
import {columns} from '@/components/tables/projects';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetProjectsForTeam} from '@/hooks/get-hooks';
import {Action} from '@faims3/data-model';
import {useNavigate} from '@tanstack/react-router';

const TeamProjects = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  const {isPending, data} = useGetProjectsForTeam({user, teamId});

  // can the user see the add button?
  const canAddProjectInTeam = useIsAuthorisedTo({
    action: Action.CREATE_PROJECT_IN_TEAM,
    // resource is the team
    resourceId: teamId,
  });

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns.filter(c => c.id !== 'team')}
      data={data || []}
      loading={isPending}
      onRowClick={({project_id}) => navigate({to: `/projects/${project_id}`})}
      button={
        canAddProjectInTeam && <CreateProjectDialog specifiedTeam={teamId} />
      }
    />
  );
};

export default TeamProjects;
