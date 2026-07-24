import {Form} from '@/components/form';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {updateTeam} from '@/hooks/teams-hooks';
import {resourceNameSchema} from '@/lib/input-limits';
import {INPUT_LIMITS} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

interface UpdateTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  name: string;
  description: string;
  teamId: string;
}

/**
 * CreateProjectForm component renders a form for creating a project.
 * It provides a button to open the dialog and a form to create the project.
 *
 * @param {UpdateTeamFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateProjectForm component.
 */
export function UpdateTeamForm({
  setDialogOpen,
  name,
  teamId,
  description,
}: UpdateTeamFormProps) {
  const user = useRequiredUser();
  const QueryClient = useQueryClient();

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: resourceNameSchema(5, 'Team name'),
      maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
    },
    {
      name: 'description',
      label: 'Description',
      schema: z
        .string()
        .min(10, {
          message: 'Description must be at least 10 characters',
        })
        .max(INPUT_LIMITS.TEAM_DESCRIPTION_MAX_LENGTH, {
          message: `Description must be at most ${INPUT_LIMITS.TEAM_DESCRIPTION_MAX_LENGTH} characters`,
        }),
      maxLength: INPUT_LIMITS.TEAM_DESCRIPTION_MAX_LENGTH,
    },
  ];

  interface onSubmitProps {
    name: string;
    description: string;
  }

  /**
   * Handles the form submission
   */
  const onSubmit = async ({name, description}: onSubmitProps) => {
    const response = await updateTeam({description, name, user, teamId});

    if (!response.ok) return {type: 'submit', message: 'Error updating team'};

    QueryClient.invalidateQueries({queryKey: ['teams']});
    QueryClient.invalidateQueries({queryKey: ['teams', teamId]});

    setDialogOpen(false);
  };

  console.log('Passing in ', {name, description});

  return (
    <Form
      fields={fields}
      // Pass in default
      // TODO this is not working
      defaultValues={{name, description}}
      onSubmit={onSubmit}
      submitButtonText={'Update team'}
    />
  );
}
