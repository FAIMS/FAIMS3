// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {modifyTeamForProject} from '@/hooks/project-hooks';
import {useGetProject, useGetTeams} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {
  buildTeamField,
  defaultTeamForReassign,
  NO_TEAM_SENTINEL,
} from './template-team-field';

interface AddProjectToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectId: string;
}

/**
 * A form component that allows assigning a project to a team.
 *
 * Users with {@link Action.REMOVE_PROJECT_FROM_TEAM} may select "No team" to
 * remove ownership. The select defaults to the project's current team.
 *
 * @param setDialogOpen - A function to control the dialog's open state.
 * @param projectId - The ID of the project to be assigned to a team.
 */
export function AddProjectToTeamForm({
  setDialogOpen,
  projectId,
}: AddProjectToTeamFormProps) {
  const user = useRequiredUser();
  const QueryClient = useQueryClient();
  const teams = useGetTeams({user});
  const {data: project, isLoading: projectLoading} = useGetProject({
    user,
    projectId,
  });

  // can we add a user to the team?
  const canAddProjectToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_TEAM,
    resourceId: projectId,
  });

  const canRemoveFromTeam = useIsAuthorisedTo({
    action: Action.REMOVE_PROJECT_FROM_TEAM,
    resourceId: projectId,
  });

  const possibleTeams = teams.data?.teams ?? [];

  if (!canAddProjectToTeam) {
    return (
      <>
        You do not have permission to change the ownership of this{' '}
        {config.notebookName}
      </>
    );
  }

  if (teams.isLoading || projectLoading) {
    return <>Loading teams...</>;
  }

  if (!teams.isLoading && possibleTeams.length === 0 && !canRemoveFromTeam) {
    return <>No teams available to assign this {config.notebookName} to.</>;
  }

  const fields = [
    buildTeamField({
      canCreateGlobally: false,
      includeNoTeam: canRemoveFromTeam,
      possibleTeams,
      label: 'Team',
      description: canRemoveFromTeam
        ? `Choose a team to own this ${config.notebookName}, or select "No team" to remove team ownership.`
        : `Choose a team to own this ${config.notebookName}.`,
    }),
  ];

  /**
   * Handles the form submission
   */
  const onSubmit = async ({team}: {team?: string}) => {
    const teamId = team === NO_TEAM_SENTINEL ? undefined : team || undefined;
    const response = await modifyTeamForProject({
      projectId,
      teamId,
      user,
    });

    if (!response.ok)
      return {
        type: 'submit',
        message: 'Error adding project to team: ' + response.statusText,
      };

    const previousTeamId = project?.ownedByTeamId;

    QueryClient.invalidateQueries({queryKey: ['projects', projectId]});
    QueryClient.invalidateQueries({queryKey: ['projects']});
    if (teamId) {
      QueryClient.invalidateQueries({
        queryKey: ['projectsbyteam', user.token, teamId],
      });
    }
    if (previousTeamId && previousTeamId !== teamId) {
      QueryClient.invalidateQueries({
        queryKey: ['projectsbyteam', user.token, previousTeamId],
      });
    }

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={'Assign to Team'}
      defaultValues={{
        team: defaultTeamForReassign({
          ownerTeamId: project?.ownedByTeamId,
          possibleTeams,
          canUnassign: canRemoveFromTeam,
        }),
      }}
    />
  );
}
