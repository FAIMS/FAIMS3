import {Field, Form} from '@/components/form';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeams, useGetTemplates} from '@/hooks/queries';
import {Action, TemplateListItem} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {Divider} from '../ui/word-divider';
import {
  createProjectFromFile,
  createProjectFromTemplate,
} from '@/hooks/project-hooks';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';
import {designFileSchema, resourceNameSchema} from '@/lib/input-limits';
import {INPUT_LIMITS, ROOT_DESCRIPTION_MAX_LENGTH} from '@faims3/data-model';

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
  const user = useRequiredUser();
  const {refreshToken} = useAuth();
  const queryClient = useQueryClient();

  // can they create projects outside team?
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});

  const {data: templates} = useGetTemplates({user});
  const {data: teams} = useGetTeams({user});

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Name',
      schema: resourceNameSchema(5, `${config.notebookNameCapitalized} name`),
      maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
    },
    optionalRootDescriptionField({
      helperText: `Optional summary of this ${config.notebookName} (up to ${ROOT_DESCRIPTION_MAX_LENGTH} characters)`,
    }),
    {
      name: 'template',
      label: `Existing ${config.notebookNameCapitalized} Template (optional)`,
      options: templates?.map(({_id, name}: TemplateListItem) => ({
        label: name,
        value: _id,
      })),
      schema: z.any().optional(),
      excludedBy: 'file',
    },
    {
      name: 'file',
      label: 'JSON File (optional)',
      type: 'file',
      schema: designFileSchema().optional(),
      excludedBy: 'template',
    },
  ];

  const dividers = [
    {index: 2, component: <div className="h-5" />},
    {index: 3, component: <Divider word="OR" />},
  ];

  if (!specifiedTeam) {
    fields.push({
      name: 'team',
      label: `Create ${config.notebookName} in this team${
        canCreateGlobally ? ' (optional)' : ''
      }`,
      options: teams?.teams.map(({_id, name}) => ({
        label: name,
        value: _id,
      })),
      schema: canCreateGlobally ? z.string().optional() : z.string(),
    });
    dividers.push({index: 4, component: <div className="h-5" />});
  }

  interface onSubmitProps {
    name: string;
    description?: string;
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
  const onSubmit = async ({
    name,
    description,
    template,
    file,
    team,
  }: onSubmitProps) => {
    let response;
    if (template) {
      // Create from selected template
      response = await createProjectFromTemplate({
        user,
        name,
        description,
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
        description,
        file: fileToUpload,
        teamId: specifiedTeam ?? team,
      });
    }

    if (!response.ok) {
      return {type: 'submit', message: `Error creating ${config.notebookName}`};
    }
    // need to refresh our auth token to get permissions on this new template
    const {message, status} = await refreshToken();
    if (status === 'error') {
      return {
        type: 'submit',
        message: `template created but failed to refresh user token: ${message}`,
      };
    }

    await queryClient.invalidateQueries({queryKey: ['projects']});
    await queryClient.invalidateQueries({queryKey: ['projectsbyteam']});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      dividers={dividers}
      onSubmit={onSubmit}
      submitButtonText={`Create ${config.notebookNameCapitalized}`}
      // pass in team ID default, if provided
      defaultValues={{team: defaultValues?.teamId}}
    />
  );
}
