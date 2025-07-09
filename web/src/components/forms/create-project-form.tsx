import {Field, Form} from '@/components/form';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeams, useGetTemplates} from '@/hooks/queries';
import {Action, GetTemplateByIdResponse} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {Divider} from '../ui/word-divider';
import {
  createProjectFromFile,
  createProjectFromTemplate,
} from '@/hooks/project-hooks';

// Import the default sample notebook JSON
import blankNotebook from '../../../notebooks/blank-notebook.json';

interface CreateProjectFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}

/**
 * CreateProjectForm component renders a form for creating a project.
 * It provides a button to open the dialog and a form to create the project.
 *
 * @param {CreateProjectFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateProjectForm component.
 */
export function CreateProjectForm({
  setDialogOpen,
  defaultValues,
  specifiedTeam = undefined,
}: CreateProjectFormProps) {
  const {user, refreshToken} = useAuth();
  const queryClient = useQueryClient();

  // can they create projects outside team?
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});

  const {data: templates} = useGetTemplates(user);
  const {data: teams} = useGetTeams(user);

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Name',
      schema: z.string().min(5, {
        message:
          NOTEBOOK_NAME_CAPITALIZED + ' name must be at least 5 characters.',
      }),
    },
    {
      name: 'template',
      label: `Existing ${NOTEBOOK_NAME_CAPITALIZED} Template (optional)`,
      options: templates?.map(({_id, name}: GetTemplateByIdResponse) => ({
        label: name,
        value: _id,
      })),
      schema: z.any().optional(),
      excludes: 'file',
    },
    {
      name: 'file',
      label: 'JSON File (optional)',
      type: 'file',
      schema: z
        .instanceof(File)
        .refine(file => file.type === 'application/json')
        .optional(),
      excludes: 'template',
    },
  ];

  const dividers = [
    {index: 1, component: <div className="h-5" />},
    {index: 2, component: <Divider word="OR" />},
  ];

  if (!specifiedTeam) {
    fields.push({
      name: 'team',
      label: `Create ${NOTEBOOK_NAME} in this team${
        canCreateGlobally ? ' (optional)' : ''
      }`,
      options: teams?.teams.map(({_id, name}) => ({
        label: name,
        value: _id,
      })),
      schema: canCreateGlobally ? z.string().optional() : z.string(),
    });
    dividers.push({index: 3, component: <div className="h-5" />});
  }

  interface onSubmitProps {
    name: string;
    team?: string;
    template?: string;
    file?: File;
  }

  /**
   * Handles the form submission
   *
   * @param {{name: string, template?: string, file?: File}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name, template, file, team}: onSubmitProps) => {
    if (!user) {
      return {type: 'submit', message: 'User not authenticated'};
    }

    let response;
    if (template) {
      // Create from selected template
      response = await createProjectFromTemplate({
        user,
        name,
        template,
        teamId: specifiedTeam ?? team,
      });
    } else {
      // No template chosen: either use uploaded file or default blank notebook
      let fileToUpload = file;
      if (!fileToUpload) {
        // Construct a File object
        const blob = new Blob([JSON.stringify(blankNotebook)], {
          type: 'application/json',
        });
        fileToUpload = new File([blob], 'sample_notebook.json', {
          type: 'application/json',
        });
      }
      response = await createProjectFromFile({
        user,
        name,
        file: fileToUpload,
        teamId: specifiedTeam ?? team,
      });
    }

    if (!response.ok) {
      return {type: 'submit', message: `Error creating ${NOTEBOOK_NAME}`};
    }
    // need to refresh our auth token to get permissions on this new template
    const {message, status} = await refreshToken();
    if (status === 'error') {
      return {
        type: 'submit',
        message: `template created but failed to refresh user token: ${message}`,
      };
    }

    if (specifiedTeam || team) {
      await queryClient.invalidateQueries({
        queryKey: ['projectsbyteam', specifiedTeam || team],
      });
    }
    await queryClient.invalidateQueries({queryKey: ['projects']});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      dividers={dividers}
      onSubmit={onSubmit}
      submitButtonText={`Create ${NOTEBOOK_NAME_CAPITALIZED}`}
      // pass in team ID default, if provided
      defaultValues={{team: defaultValues?.teamId}}
    />
  );
}
