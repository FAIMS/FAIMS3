import {Form} from '@/components/form';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {
  errorMessageFromTemplateJsonBody,
  updateTemplateRequest,
} from '@/hooks/template-hooks';
import {useQueryClient} from '@tanstack/react-query';
import {resourceNameSchema} from '@/lib/input-limits';
import {INPUT_LIMITS} from '@faims3/data-model';
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
  const user = useRequiredUser();
  const queryClient = useQueryClient();

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: resourceNameSchema(1, 'Name'),
      maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
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
