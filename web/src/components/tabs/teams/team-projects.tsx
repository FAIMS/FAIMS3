// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {CreateProjectDialog} from '@/components/dialogs/create-project-dialog';
import {columns} from '@/components/tables/projects';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeam, usePagedProjects} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {useNavigate} from '@tanstack/react-router';

const TeamProjects = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  const {tableLoading, notebooks, pageSize, serverPagination, serverSearch} =
    usePagedProjects({user, teamId});
  const {data: team} = useGetTeam({user, teamId});
  const archived = team?.archived === true;

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
      data={notebooks}
      loading={tableLoading}
      defaultRowsPerPage={pageSize}
      serverPagination={serverPagination}
      serverSearch={serverSearch}
      onRowClick={({_id}) => navigate({to: `/projects/${_id}`})}
      button={
        canAddProjectInTeam &&
        !archived && <CreateProjectDialog specifiedTeam={teamId} />
      }
    />
  );
};

export default TeamProjects;
