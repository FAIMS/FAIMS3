import {Field, Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {modifyTeamForProject} from '@/hooks/project-hooks';
import {useGetTeams} from '@/hooks/queries';
import {Action} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

interface AddProjectToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectId: string;
}

/**
 * A form component that allows assigning a project to a team.
 *
 * @param setDialogOpen - A function to control the dialog's open state.
 * @param projectId - The ID of the project to be assigned to a team.
 */
export function AddProjectToTeamForm({
  setDialogOpen,
  projectId,
}: AddProjectToTeamFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();
  const teams = useGetTeams(user);

  // can we add a user to the team?
  const canAddProjectToTeam = useIsAuthorisedTo({
    action: Action.CHANGE_PROJECT_TEAM,
    resourceId: projectId,
  });

  const teamsAvailable = teams.data?.teams;

  if (!canAddProjectToTeam || !teamsAvailable) {
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

    QueryClient.invalidateQueries({
      queryKey: ['projectsbyteam', user.token, teamId],
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
