import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME} from '@/constants';

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

export function UpdateTemplateForm({setDialogOpen}: UpdateTemplateFormProps) {
  const {user} = useAuth();

  const onSubmit = async ({file}: {file: File}) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const jsonString = await readFileAsText(file);

    if (!jsonString) return {type: 'submit', message: 'Error reading file'};

    const {_id} = JSON.parse(jsonString);

    if (!_id) return {type: 'submit', message: 'Error parsing file'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/templates/${_id}`,
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
