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
  onSuccess: () => void;
}

/**
 * UpdateTemplateForm component renders a form for updating a template.
 * It provides a button to open the dialog and a form to update the template.
 * The onSuccess callback is called after a successful update.
 *
 * @returns {JSX.Element} The rendered UpdateTemplateForm component.
 */
export function UpdateTemplateForm({
  setDialogOpen,
  onSuccess,
}: UpdateTemplateFormProps) {
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

    // call the onSuccess callback if everything worked
    onSuccess();
    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Upload Template JSON"
      submitButtonVariant="destructive"
      warningMessage={`Editing the template does not change any of the ${NOTEBOOK_NAME}s created from it.  This may create inconsistencies in your data.`}
    />
  );
}
