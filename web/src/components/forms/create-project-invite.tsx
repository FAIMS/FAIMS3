import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {Route} from '@/routes/_protected/projects/$projectId';
import {Resource, Role, roleDetails, RoleScope} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

export const fields = [
  {
    name: 'role',
    label: 'Role',
    options: Object.entries(roleDetails)
      .filter(
        ([, {scope, resource}]) =>
          scope === RoleScope.RESOURCE_SPECIFIC && resource === Resource.PROJECT
      )
      .map(([value, {name: label}]) => ({label, value})),
    schema: z.nativeEnum(Role),
  },
];

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
  const {projectId} = Route.useParams();
  const QueryClient = useQueryClient();

  /**
   * Handles the form submission
   *
   * @param {z.infer<typeof fields[0]['schema']>} role - The role to invite
   * @returns {Promise<void>} A promise that resolves when the invite is created
   */
  const onSubmit = async ({role}: {role: string}) => {
    if (!user) return {type: 'submit', message: 'Not logged in'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/invites`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({role}),
      }
    );

    if (!response.ok)
      return {type: 'submit', message: 'Error creating invite.'};

    QueryClient.invalidateQueries({queryKey: ['invites', projectId]});

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
