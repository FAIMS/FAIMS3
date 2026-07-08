import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {
  errorMessageFromNotebookJsonBody,
  updateNotebookMetadataRequest,
} from '@/hooks/project-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';

interface EditProjectDetailsFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectId: string;
  name: string;
  description?: string;
}

/**
 * Form to update survey root metadata (name, description) via PUT /api/notebooks/:id.
 */
export function EditProjectDetailsForm({
  setDialogOpen,
  projectId,
  name,
  description,
}: EditProjectDetailsFormProps) {
  const {user} = useAuth();
  const queryClient = useQueryClient();

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().trim().min(1, {message: 'Name is required'}),
    },
    optionalRootDescriptionField(),
  ];

  const onSubmit = async ({
    name: nextName,
    description: nextDescription,
  }: {
    name: string;
    description: string;
  }) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const response = await updateNotebookMetadataRequest({
      user,
      projectId,
      name: nextName.trim(),
      description: nextDescription,
    });

    if (!response.ok) {
      const json: unknown = await response.json().catch(() => undefined);
      return {
        type: 'submit',
        message: errorMessageFromNotebookJsonBody(json, response.statusText),
      };
    }

    await queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    await queryClient.invalidateQueries({queryKey: ['projects']});
    await queryClient.invalidateQueries({queryKey: ['projectsbyteam']});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      defaultValues={{name, description: description ?? ''}}
      onSubmit={onSubmit}
      submitButtonText="Save details"
    />
  );
}
