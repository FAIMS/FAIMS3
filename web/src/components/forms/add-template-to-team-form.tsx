import {Field, Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeams} from '@/hooks/queries';
import {updateTemplateRequest} from '@/hooks/template-hooks';
import {Action} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

interface AddTemplateToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templateId: string;
}

/**
 * A form component that allows assigning a project to a team.
 *
 * @param setDialogOpen - A function to control the dialog's open state.
 * @param projectId - The ID of the project to be assigned to a team.
 */
export function AddTemplateToTeamForm({
  setDialogOpen,
  templateId,
}: AddTemplateToTeamFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();
  const teams = useGetTeams({user});

  // can we add a user to the team?
  const canAddTemplateToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_TEMPLATE_STATUS,
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
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const response = await updateTemplateRequest({
      templateId,
      teamId,
      user,
    });

    if (!response.ok)
      return {
        type: 'submit',
        message: 'Error adding project to team: ' + response.statusText,
      };

    QueryClient.invalidateQueries({
      queryKey: ['templatesbyteam', user.token, teamId],
    });

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
