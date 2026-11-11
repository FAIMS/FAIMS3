// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeams, useGetTemplate} from '@/hooks/queries';
import {
  errorMessageFromTemplateJsonBody,
  modifyTeamForTemplate,
} from '@/hooks/template-hooks';
import {Action} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {
  buildTeamField,
  defaultTeamForReassign,
  NO_TEAM_SENTINEL,
} from './template-team-field';

interface AddTemplateToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templateId: string;
}

/**
 * A form component that allows assigning a template to a team (updates
 * {@link ownedByTeamId} via PUT /api/templates/:id/team).
 *
 * Users with {@link Action.REMOVE_TEMPLATE_FROM_TEAM} may select "No team" to
 * remove ownership. The select defaults to the template's current team.
 *
 * @param setDialogOpen - A function to control the dialog's open state.
 * @param templateId - The ID of the template to assign to a team.
 */
export function AddTemplateToTeamForm({
  setDialogOpen,
  templateId,
}: AddTemplateToTeamFormProps) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const teams = useGetTeams({user});
  const {data: template, isLoading: templateLoading} = useGetTemplate({
    user,
    templateId,
  });

  const canAddTemplateToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_TEAM,
    resourceId: templateId,
  });

  const canRemoveFromTeam = useIsAuthorisedTo({
    action: Action.REMOVE_TEMPLATE_FROM_TEAM,
    resourceId: templateId,
  });

  if (!canAddTemplateToTeam) {
    return (
      <p>You do not have permission to change the team for this template.</p>
    );
  }

  if (teams.isLoading || templateLoading) {
    return <>Loading teams...</>;
  }

  const possibleTeams = teams.data?.teams ?? [];

  if (!teams.isLoading && possibleTeams.length === 0 && !canRemoveFromTeam) {
    return <>No teams available to assign this template to.</>;
  }

  const fields = [
    buildTeamField({
      canCreateGlobally: false,
      includeNoTeam: canRemoveFromTeam,
      possibleTeams,
      label: 'Team',
      description: canRemoveFromTeam
        ? 'Choose a team to own this template, or select "No team" to remove team ownership.'
        : 'Choose a team to own this template.',
    }),
  ];

  /**
   * Handles the form submission
   */
  const onSubmit = async ({team}: {team?: string}) => {
    const teamId = team === NO_TEAM_SENTINEL ? undefined : team || undefined;
    const response = await modifyTeamForTemplate({
      templateId,
      teamId,
      user,
    });

    if (!response.ok) {
      const json: unknown = await response.json().catch(() => undefined);
      return {
        type: 'submit',
        message:
          'Error assigning template to team: ' +
          errorMessageFromTemplateJsonBody(json, response.statusText),
      };
    }

    const previousTeamId = template?.ownedByTeamId;
    await queryClient.invalidateQueries({queryKey: ['templates', templateId]});
    await queryClient.invalidateQueries({queryKey: ['templates']});
    if (teamId) {
      await queryClient.invalidateQueries({
        queryKey: ['templatesbyteam', user.token, teamId],
      });
    }
    if (previousTeamId && previousTeamId !== teamId) {
      await queryClient.invalidateQueries({
        queryKey: ['templatesbyteam', user.token, previousTeamId],
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
          ownerTeamId: template?.ownedByTeamId,
          possibleTeams,
          canUnassign: canRemoveFromTeam,
        }),
      }}
    />
  );
}
