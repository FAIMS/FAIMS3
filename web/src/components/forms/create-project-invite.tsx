import { Field, Form } from '@/components/form';
import { useAuth } from '@/context/auth-provider';
import { userCanDo } from '@/hooks/auth-hooks';
import { Route } from '@/routes/_protected/projects/$projectId';
import {
    PostCreateInviteInput,
    projectInviteToAction, Resource, Role, roleDetails, RoleScope
} from '@faims3/data-model';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorComponent } from '@tanstack/react-router';
import { z } from 'zod';

interface UpdateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Form to create a new invite for a project
 *
 * @param {UpdateTemplateFormProps} props - The props for the form
 * @returns {JSX.Element} The rendered form
 */
export function CreateProjectInviteForm({
  setDialogOpen,
}: UpdateTemplateFormProps) {
  const {user} = useAuth();

  if (!user) {
    return <ErrorComponent error="Not authenticated" />;
  }

  const {projectId} = Route.useParams();
  const QueryClient = useQueryClient();

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Invite title',
      schema: z.string().min(4),
    },
    {
      name: 'role',
      label: 'Role',
      options: Object.entries(roleDetails)
        .filter(
          ([role, {scope, resource}]) =>
            scope === RoleScope.RESOURCE_SPECIFIC &&
            resource === Resource.PROJECT &&
            userCanDo({
              user,
              resourceId: projectId,
              action: projectInviteToAction({
                action: 'create',
                role: role as Role,
              }),
            })
        )
        .map(([value, {name: label}]) => ({label, value})),
      schema: z.nativeEnum(Role),
    },
    {
      name: 'uses',
      label: 'Maximum uses (leave empty to set no limit)',
      schema: z.number().min(1).optional(),
      type: 'number',
      min: 1,
    },
    {
      name: 'expiry',
      label: 'Invite expiration time',
      type: 'datetime-local',
      schema: z.string().min(1, 'Please select a date and time'),
    },
  ];

  /**
   * Handles the form submission
   *
   * @param {z.infer<typeof fields[0]['schema']>} role - The role to invite
   * @returns {Promise<void>} A promise that resolves when the invite is created
   */
  const onSubmit = async ({
    role,
    uses,
    name,
    expiry,
  }: {
    role: string;
    uses?: number;
    name: string;
    expiry: string;
  }) => {
    if (!user) return {type: 'submit', message: 'Not logged in'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/invites/notebook/${projectId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name,
          role: role as Role,
          uses,
          expiry: expiry ? new Date(expiry).getTime() : undefined,
        } satisfies PostCreateInviteInput),
      }
    );

    if (!response.ok)
      return {type: 'submit', message: 'Error creating invite.'};

    QueryClient.invalidateQueries({queryKey: ['projectinvites', projectId]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={'Create Invite'}
    />
  );
}
