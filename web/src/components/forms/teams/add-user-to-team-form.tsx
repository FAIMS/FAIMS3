import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {Field} from '@/components/form';
import {z} from 'zod';

const fields: Field[] = [
  {
    name: 'email',
    label: 'User Email',
    schema: z.string().email(),
  },
  {
    name: 'role',
    label: 'Role',
    // TODO use role enum once import works
    options: ['TEAM_MEMBER', 'TEAM_MANAGER', 'TEAM_ADMIN'].map(r => ({
      label: r,
      value: r,
    })),
    schema: z.enum(['TEAM_MEMBER', 'TEAM_MANAGER', 'TEAM_ADMIN']),
  },
];

interface AddUserToTeamFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  teamId: string;
}

/**
 */
export function AddUserToTeamForm({
  setDialogOpen,
  teamId,
}: AddUserToTeamFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();

  interface onSubmitProps {
    email: string;
    role: string;
  }

  /**
   * Handles the form submission
   */
  const onSubmit = async ({email, role}: onSubmitProps) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const response = await modifyMemberForTeam({
      action: 'ADD_ROLE',
      email,
      role,
      teamId,
      user,
    });

    if (!response.ok)
      return {
        type: 'submit',
        message:
          'Error adding user to team! Are you sure the email is correct?',
      };

    QueryClient.invalidateQueries({queryKey: ['teamusers', teamId]});

    setDialogOpen(false);
  };

  return (
    <Form fields={fields} onSubmit={onSubmit} submitButtonText={'Add User'} />
  );
}
