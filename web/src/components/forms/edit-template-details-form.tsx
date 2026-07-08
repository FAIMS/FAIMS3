import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {
  errorMessageFromTemplateJsonBody,
  updateTemplateRequest,
} from '@/hooks/template-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';

interface EditTemplateDetailsFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templateId: string;
  name: string;
  description?: string;
}

/**
 * Form to update template root metadata (name, description) via PUT /api/templates/:id.
 */
export function EditTemplateDetailsForm({
  setDialogOpen,
  templateId,
  name,
  description,
}: EditTemplateDetailsFormProps) {
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

    const response = await updateTemplateRequest({
      user,
      templateId,
      name: nextName.trim(),
      description: nextDescription,
    });

    if (!response.ok) {
      const json: unknown = await response.json().catch(() => undefined);
      return {
        type: 'submit',
        message: errorMessageFromTemplateJsonBody(json, response.statusText),
      };
    }

    await queryClient.invalidateQueries({queryKey: ['templates', templateId]});
    await queryClient.invalidateQueries({queryKey: ['templates']});
    await queryClient.invalidateQueries({queryKey: ['templatesbyteam']});

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
