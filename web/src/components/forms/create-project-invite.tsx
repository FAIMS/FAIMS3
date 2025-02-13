import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {Route} from '@/routes/projects/$projectId';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';

export const fields = [
  {
    name: 'role',
    label: `Role`,
    options: [
      {label: 'User', value: 'user'},
      {label: 'Team', value: 'team'},
      {label: 'Moderator', value: 'moderator'},
      {label: 'Admin', value: 'admin'},
    ],
    schema: z.any(),
  },
];

interface UpdateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function CreateProjectInviteForm({
  setDialogOpen,
}: UpdateTemplateFormProps) {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const QueryClient = useQueryClient();

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
      return {type: 'submit', message: `Error creating invite.`};

    QueryClient.invalidateQueries({queryKey: ['invites', projectId]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Create Invite`}
    />
  );
}
