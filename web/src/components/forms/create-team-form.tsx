import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {createTeam} from '@/hooks/create-team';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

interface CreateTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * CreateProjectForm component renders a form for creating a project.
 * It provides a button to open the dialog and a form to create the project.
 *
 * @param {CreateTeamFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateProjectForm component.
 */
export function CreateTeamForm({setDialogOpen}: CreateTeamFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().min(5, {
        message: 'Team name must be at least 5 characters',
      }),
    },
    {
      name: 'description',
      label: 'Description',
      schema: z.string().min(10, {
        message: 'Description must be at least 10 characters',
      }),
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
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const response = await createTeam({description, name, user});

    if (!response.ok) return {type: 'submit', message: 'Error creating team'};

    QueryClient.invalidateQueries({queryKey: ['teams', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={'Create team'}
    />
  );
}
