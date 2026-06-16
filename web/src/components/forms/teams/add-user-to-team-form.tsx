import {Field, Form} from '@/components/form';
import {EXCLUDED_TEAM_ROLES, brandNotebook} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {Action, Role, roleDetails} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

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
    rolesAvailable.push(Role.TEAM_MEMBER_CREATOR);
  }
  if (canAddManagerToTeam) {
    rolesAvailable.push(Role.TEAM_MANAGER);
  }
  if (canAddAdminToTeam) {
    rolesAvailable.push(Role.TEAM_ADMIN);
  }

  // DASS hides TEAM_MEMBER_CREATOR.
  const visibleRoles = rolesAvailable.filter(r => !EXCLUDED_TEAM_ROLES.has(r));

  const fields: Field[] = [
    {
      name: 'email',
      label: 'User Email',
      schema: z.string().email(),
    },
    {
      name: 'role',
      label: 'Role',
      options: visibleRoles.map(r => ({
        label: roleDetails[r].name,
        value: r,
        description: brandNotebook(roleDetails[r].description),
      })),
      schema: z.enum([
        Role.TEAM_MEMBER,
        Role.TEAM_MEMBER_CREATOR,
        Role.TEAM_MANAGER,
        Role.TEAM_ADMIN,
      ]),
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

    if (!response.ok) {
      const responseBody = await response.json();
      const message = responseBody.error.message || 'Error adding user to team';
      return {
        type: 'submit',
        message,
      };
    }

    QueryClient.invalidateQueries({queryKey: ['teamusers', teamId]});

    setDialogOpen(false);
  };

  return (
    <Form fields={fields} onSubmit={onSubmit} submitButtonText={'Add User'} />
  );
}
