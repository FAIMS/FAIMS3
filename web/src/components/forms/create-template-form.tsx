import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetTeams} from '@/hooks/get-hooks';

interface CreateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * CreateTemplateForm component renders a form for creating a template.
 * It provides a button to open the dialog and a form to create the template.
 *
 * @param {CreateTemplateFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateTemplateForm component.
 */
export function CreateTemplateForm({setDialogOpen}: CreateTemplateFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();

  const {data: teams} = useGetTeams(user);

  const fields = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().min(5, {
        message: 'Template name must be at least 5 characters.',
      }),
    },
    {
      name: 'team',
      label: 'Create template in team?',
      options: teams?.teams.map(({_id, name}) => ({
        label: name,
        value: _id,
      })),
      schema: z.string().optional(),
    },
    {
      name: 'file',
      label: 'Template File',
      type: 'file',
      schema: z
        .instanceof(File)
        .refine(file => file.type === 'application/json'),
    },
  ];

  const onSubmit = async ({
    name,
    file,
    team,
  }: {
    name: string;
    file: File;
    team?: string;
  }) => {
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
      `${import.meta.env.VITE_API_URL}/api/templates/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({teamId: team, template_name: name, ...json}),
      }
    );

    if (!response.ok) {
      console.log(response);
      return {type: 'submit', message: 'Error creating template'};
    }

    // query invals
    if (team) {
      QueryClient.invalidateQueries({queryKey: ['templatesbyteam', team]});
    }
    QueryClient.invalidateQueries({queryKey: ['templates', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Create Template"
    />
  );
}
