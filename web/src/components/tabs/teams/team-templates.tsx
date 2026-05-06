import {DataTable} from '@/components/data-table/data-table';
import {CreateTemplateDialog} from '@/components/dialogs/create-template-dialog';
import {getTemplatesTableColumns} from '@/components/tables/templates';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTemplatesForTeam} from '@/hooks/queries';
import {Action, globalRolesGrantAction} from '@faims3/data-model';
import {useNavigate} from '@tanstack/react-router';
import {useMemo} from 'react';

const TeamTemplates = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();
  const {isPending, data} = useGetTemplatesForTeam({user, teamId});

  // can the user see the add button?
  const canAddTemplateInTeam = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE_IN_TEAM,
    // resource is the team
    resourceId: teamId,
  });

  const navigate = useNavigate();

  const columns = useMemo(
    () =>
      getTemplatesTableColumns({
        hideTeamColumn: true,
        includeVisibility: globalRolesGrantAction(
          user?.decodedToken ?? {
            globalRoles: [],
            resourceRoles: [],
          },
          Action.CHANGE_TEMPLATE_VISIBILITY
        ),
      }),
    [user?.decodedToken]
  );

  return (
    <DataTable
      columns={columns}
      data={data?.templates || []}
      loading={isPending}
      onRowClick={({_id}) => navigate({to: `/templates/${_id}`})}
      button={
        canAddTemplateInTeam && <CreateTemplateDialog specifiedTeam={teamId} />
      }
    />
  );
};

export default TeamTemplates;
