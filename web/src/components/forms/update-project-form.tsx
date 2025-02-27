import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME} from '@/constants';
import {Route} from '@/routes/projects/$projectId';

export const fields = [
  {
    name: 'file',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

export function UpdateProjectForm({
  setDialogOpen,
}: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {user} = useAuth();
  const {projectId} = Route.useParams();

  const onSubmit = async ({file}: {file: File}) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const jsonString = await readFileAsText(file);

    if (!jsonString) return {type: 'submit', message: 'Error reading file'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}`,
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
      submitButtonText={`Update ${NOTEBOOK_NAME}`}
      submitButtonVariant="destructive"
      warningMessage={`Editing the survey may result in inconsistencies between responses.`}
    />
  );
}
