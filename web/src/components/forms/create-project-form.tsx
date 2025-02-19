import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';

interface CreateProjectFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const fields = [
  {
    name: 'name',
    label: 'Name',
    schema: z.string().min(5, {
      message: 'Project name must be at least 5 characters.',
    }),
  },
  {
    name: 'file',
    label: 'Project File',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

/**
 * CreateProjectForm component renders a form for creating a project.
 * It provides a button to open the dialog and a form to create the project.
 *
 * @param {CreateProjectFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateProjectForm component.
 */
export function CreateProjectForm({setDialogOpen}: CreateProjectFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();

  const onSubmit = async ({name, file}: {name: string; file: File}) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const jsonString = await readFileAsText(file);

    if (!jsonString) return {type: 'submit', message: 'Error reading file'};

    let json;
    try {
      json = JSON.parse(jsonString);
    } catch (e) {
      return {type: 'submit', message: 'Error parsing file'};
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/notebooks/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({name, ...json}),
      }
    );

    if (!response.ok) {
      console.log(response);
      return {type: 'submit', message: 'Error creating project'};
    }

    QueryClient.invalidateQueries({queryKey: ['projects', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Create Project"
    />
  );
}
