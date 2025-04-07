import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {Field} from '@/components/form';
import {z} from 'zod';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {
  Action,
  Resource,
  Role,
  roleDetails,
  RoleScope,
} from '@faims3/data-model';

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

  // can we add a user to the team?
  const canAddMemberToTeam = useIsAuthorisedTo({
    action: Action.ADD_MEMBER_TO_TEAM,
    resourceId: teamId,
  });
  const canAddManagerToTeam = useIsAuthorisedTo({
    action: Action.ADD_MANAGER_TO_TEAM,
    resourceId: teamId,
  });
  const canAddAdminToTeam = useIsAuthorisedTo({
    action: Action.ADD_ADMIN_TO_TEAM,
    resourceId: teamId,
  });

  const rolesAvailable: Role[] = [];
  if (canAddMemberToTeam) {
    rolesAvailable.push(Role.TEAM_MEMBER);
  }
  if (canAddManagerToTeam) {
    rolesAvailable.push(Role.TEAM_MANAGER);
  }
  if (canAddAdminToTeam) {
    rolesAvailable.push(Role.TEAM_ADMIN);
  }

  const fields: Field[] = [
    {
      name: 'email',
      label: 'User Email',
      schema: z.string().email(),
    },
    {
      name: 'role',
      label: 'Role',
      options: rolesAvailable.map(r => ({
        label: roleDetails[r].name,
        value: r,
      })),
      schema: z.enum(['TEAM_MEMBER', 'TEAM_MANAGER', 'TEAM_ADMIN']),
    },
  ];

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
