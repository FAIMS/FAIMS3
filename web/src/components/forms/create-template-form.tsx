import {useAuth} from '@/context/auth-provider';
import {Field, Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetTeams} from '@/hooks/queries';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

import blankNotebook from '../../../notebooks/blank-notebook.json';

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
  const queryClient = useQueryClient();
  const {data: teams} = useGetTeams(user);

  // can they create projects outside team?
  const canCreateGlobally = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE,
  });

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Template Name',
      description:
        'Pick something clear—you can always rename it later in the designer.',
      schema: z.string().min(5, {
        message: 'Template name must be at least 5 characters.',
      }),
    },
    {
      name: 'file',
      label: 'JSON File (optional — leave blank to create a blank template)',
      description:
        'Upload a .json notebook file to pre-fill your template, or leave blank to use our built-in sample.',
      type: 'file',
      schema: z
        .instanceof(File)
        .refine(f => f.type === 'application/json', {
          message: 'Only JSON files are allowed.',
        })
        .optional(),
    },
  ];

  if (!specifiedTeam) {
    fields.push({
      name: 'team',
      label: `Team${canCreateGlobally ? ' (optional)' : ''}`,
      options: teams?.teams.map(({_id, name}) => ({
        label: name,
        value: _id,
      })),
      schema: canCreateGlobally ? z.string().optional() : z.string(),
    });
  }

  const onSubmit = async (values: {
    name: string;
    file?: File;
    team?: string;
  }) => {
    if (!user) return {type: 'submit', message: 'Not authenticated'};

    const {name, file, team} = values;
    let jsonPayload: Record<string, any> = {};

    if (file) {
      // parse the user-uploaded file
      const text = await readFileAsText(file);
      if (!text) {
        return {type: 'submit', message: 'Error reading file'};
      }
      try {
        jsonPayload = JSON.parse(text);
      } catch {
        return {type: 'submit', message: 'Invalid JSON file'};
      }
    } else {
      // pull in the sample's metadata + ui-spec
      jsonPayload = {
        metadata: (blankNotebook as any).metadata,
        'ui-specification': (blankNotebook as any)['ui-specification'],
      };
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/templates/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            teamId: team ?? specifiedTeam,
            name,
            ...jsonPayload,
          }),
        }
      );
      if (!res.ok) throw new Error(res.statusText);
    } catch {
      return {type: 'submit', message: 'Failed to create template'};
    }

    // query invals
    if (specifiedTeam || team) {
      queryClient.invalidateQueries({
        queryKey: ['templatesbyteam', specifiedTeam || team],
      });
    }
    queryClient.invalidateQueries({queryKey: ['templates', undefined]});
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
