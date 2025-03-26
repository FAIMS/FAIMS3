import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME} from '@/constants';
import {Route} from '@/routes/_protected/templates/$templateId';

export const fields = [
  {
    name: 'file',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

interface UpdateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * UpdateTemplateForm component renders a form for updating a template.
 * It provides a button to open the dialog and a form to update the template.
 *
 * @returns {JSX.Element} The rendered UpdateTemplateForm component.
 */
export function UpdateTemplateForm({setDialogOpen}: UpdateTemplateFormProps) {
  const {user} = useAuth();
  const {templateId} = Route.useParams();

  const onSubmit = async ({file}: {file: File}) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const jsonString = await readFileAsText(file);

    if (!jsonString) return {type: 'submit', message: 'Error reading file'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/templates/${templateId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: jsonString,
      }
    );

    if (!response.ok)
      return {type: 'submit', message: 'Error updating template'};

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Update Template"
      submitButtonVariant="destructive"
      warningMessage={`Editing the template may result in inconsistencies between the ${NOTEBOOK_NAME} created from it.`}
    />
  );
}
