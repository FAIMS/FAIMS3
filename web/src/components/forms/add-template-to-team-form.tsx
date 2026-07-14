import {Field, Form} from '@/components/form';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeams} from '@/hooks/queries';
import {
  errorMessageFromTemplateJsonBody,
  modifyTeamForTemplate,
} from '@/hooks/template-hooks';
import {useGetTemplate} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

interface AddTemplateToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templateId: string;
}

/**
 * A form component that allows assigning a template to a team (updates
 * {@link ownedByTeamId} via PUT /api/templates/:id/team).
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
  const {data: template} = useGetTemplate({user, templateId});

  const canAddTemplateToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_TEAM,
    resourceId: templateId,
  });

  const teamsAvailable = teams.data?.teams;

  if (!canAddTemplateToTeam || !teamsAvailable) {
    return <></>;
  }

  const fields: Field[] = [
    {
      name: 'teamId',
      label: 'Team',
      options: teamsAvailable.map(t => ({
        label: t.name,
        value: t._id,
      })),
      schema: z.string(),
    },
  ];

  interface onSubmitProps {
    teamId: string;
  }

  /**
   * Handles the form submission
   */
  const onSubmit = async ({teamId}: onSubmitProps) => {
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
    await queryClient.invalidateQueries({
      queryKey: ['templatesbyteam', user.token, teamId],
    });
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
    />
  );
}
