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
  createProjectFromTemplate,
  createProjectFromUiSpecification,
} from '@/hooks/project-hooks';
import {convertXlsformToUiSpecification} from '@/hooks/xlsform-hooks';
import {prepareNotebookUiSpecificationInputForApi} from '@faims3/data-model';
import {toast} from 'sonner';
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
      testId: 'web-projects-create-name',
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
      label: 'JSON or XLSForm File (optional)',
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
    let skippedFromConversion: {name: string; type: string}[] = [];
    const isXlsform = !!file && file.name.toLowerCase().endsWith('.xlsx');

    if (template) {
      // Create from selected template — unrelated to file conversion, unchanged
      response = await createProjectFromTemplate({
        user,
        name,
        description,
        template,
        teamId: specifiedTeam ?? team,
      });
    } else {
      let uiSpecification: unknown;

      if (isXlsform) {
        const converted = await convertXlsformToUiSpecification({
          user,
          file: file!,
        });
        if (!converted.ok) {
          return {type: 'submit', message: converted.message};
        }
        uiSpecification = converted.uiSpecification;
        skippedFromConversion = converted.skipped;
      } else if (file) {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return {type: 'submit', message: 'Invalid JSON file'};
        }
        const prepared = prepareNotebookUiSpecificationInputForApi(parsed);
        if (!prepared.ok) {
          return {type: 'submit', message: prepared.message};
        }
        uiSpecification = prepared.uiSpecification;
      } else {
        const prepared =
          prepareNotebookUiSpecificationInputForApi(blankNotebook);
        uiSpecification = prepared.ok
          ? prepared.uiSpecification
          : blankNotebook;
      }

      response = await createProjectFromUiSpecification({
        user,
        name,
        description,
        teamId: specifiedTeam ?? team,
        uiSpecification,
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

    if (isXlsform) {
      if (skippedFromConversion.length > 0) {
        const summary = skippedFromConversion
          .map(s => `${s.name} (${s.type})`)
          .join(', ');
        toast.warning(
          `${config.notebookNameCapitalized} created, but ${skippedFromConversion.length} question${skippedFromConversion.length === 1 ? '' : 's'} could not be converted: ${summary}`,
          {duration: 15000}
        );
      } else {
        toast.success(`${config.notebookNameCapitalized} created successfully`);
      }
    }
  };

  return (
    <Form
      fields={fields}
      dividers={dividers}
      onSubmit={onSubmit}
      submitButtonText={`Create ${config.notebookNameCapitalized}`}
      submitButtonTestId="web-projects-create-submit"
      // pass in team ID default, if provided
      defaultValues={{team: defaultValues?.teamId}}
    />
  );
}
