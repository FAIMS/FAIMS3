import {useAuth} from '@/context/auth-provider';
import {Field, Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetTeams} from '@/hooks/queries';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

interface CreateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}

/**
 * CreateTemplateForm component renders a form for creating a template.
 * It provides a button to open the dialog and a form to create the template.
 *
 * @param {CreateTemplateFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateTemplateForm component.
 */
export function CreateTemplateForm({
  setDialogOpen,
  defaultValues,
  specifiedTeam = undefined,
}: CreateTemplateFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();
  const {data: teams} = useGetTeams(user);

  // can they create projects outside team?
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_TEMPLATE});

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().min(5, {
        message: 'Template name must be at least 5 characters.',
      }),
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
  if (!specifiedTeam) {
    fields.push({
      name: 'team',
      label: `Create template in this team${canCreateGlobally && ' (optional)'}`,
      options: teams?.teams.map(({_id, name}) => ({
        label: name,
        value: _id,
      })),
      schema: canCreateGlobally ? z.string().optional() : z.string(),
    });
  }

  const onSubmit = async ({
    file,
    team,
    name,
  }: {
    // Doesn't currently do anything!
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
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/templates/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({teamId: team ?? specifiedTeam, ...json, name}),
        }
      );

      if (!response.ok) throw Error(response.statusText);
    } catch (e) {
      return {type: 'submit', message: 'Error creating template'};
    }

    // query invals
    if (specifiedTeam || team) {
      QueryClient.invalidateQueries({
        queryKey: ['templatesbyteam', specifiedTeam || team],
      });
    }
    QueryClient.invalidateQueries({queryKey: ['templates', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Create Template"
      defaultValues={{team: defaultValues?.teamId}}
    />
  );
}
