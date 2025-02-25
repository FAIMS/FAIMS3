import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetTemplates} from '@/hooks/get-hooks';
import {Divider} from '../ui/word-divider';
import {
  createProjectFromFile,
  createProjectFromTemplate,
} from '@/hooks/create-project';

interface CreateProjectFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

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

  const {data: templates} = useGetTemplates(user);

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().min(5, {
        message: 'Project name must be at least 5 characters.',
      }),
    },
    {
      name: 'template',
      label: 'Existing Survey Template',
      options: templates?.map(({_id, template_name}: any) => ({
        label: template_name,
        value: _id,
      })),
      schema: z.any().optional(),
      excludes: 'file',
    },
    {
      name: 'file',
      label: 'Project File',
      type: 'file',
      schema: z
        .instanceof(File)
        .refine(file => file.type === 'application/json')
        .optional(),
      excludes: 'template',
    },
  ];

  const dividers = [
    {
      index: 1,
      component: <div className="h-4" />,
    },
    {
      index: 2,
      component: <Divider word="OR" />,
    },
  ];

  interface onSubmitProps {
    name: string;
    template?: string;
    file?: File;
  }

  /**
   * Handles the form submission
   *
   * @param {{name: string, template?: string, file?: File}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name, template, file}: onSubmitProps) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    if (!template && !file)
      return {type: 'submit', message: 'No file or template selected'};

    const response = file
      ? await createProjectFromFile(user, name, file)
      : await createProjectFromTemplate(user, name, template || '');

    if (!response.ok)
      return {type: 'submit', message: 'Error creating project'};

    QueryClient.invalidateQueries({queryKey: ['projects', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      dividers={dividers}
      onSubmit={onSubmit}
      submitButtonText="Create Project"
    />
  );
}
