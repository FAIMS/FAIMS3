// SPDX-License-Identifier: Apache-2.0
import {Field, Form} from '@/components/form';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeams, useGetTemplate, useGetTemplates} from '@/hooks/queries';
import {Action, TemplateListItem} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useState} from 'react';
import {z} from 'zod';
import {Divider} from '../ui/word-divider';
import {
  createProjectFromFile,
  createProjectFromTemplate,
  errorMessageFromNotebookJsonBody,
} from '@/hooks/project-hooks';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';
import {designFileSchema, resourceNameSchema} from '@/lib/input-limits';
import {INPUT_LIMITS, ROOT_DESCRIPTION_MAX_LENGTH} from '@faims3/data-model';
import {usePlanConfigs} from '@/components/plans/usePlanConfigs';
import {
  collectSetupValues,
  setupFieldsToFormFields,
  setupSubmissionGate,
} from '@/lib/setupFormFields';
import {SetupFormHeading} from './setup-form-heading';
import {TemplateOwnerCallout} from './template-owner-callout';
import {
  buildTeamField,
  getPossibleTeamsForAction,
  getTeamFieldState,
  resolveTeamId,
} from './template-team-field';

// Import the default sample notebook JSON
import blankNotebook from '../../../notebooks/blank-notebook.json';

interface CreateProjectFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}

/**
 * CreateProjectForm component renders a form for creating a project.
 *
 * Team UI follows {@link getTeamFieldState}: a callout when the user must
 * create in their only team, or a required dropdown when they have a choice.
 * Global creators (`CREATE_PROJECT`) may select "No team" to omit ownership.
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

  const possibleTeams = getPossibleTeamsForAction({
    teams: teams?.teams,
    canCreateGlobally,
    createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
    decodedToken: user.decodedToken,
  });

  const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
    canCreateGlobally,
    specifiedTeam,
    possibleTeams,
  });

  // The template picker only has list items; fetch the full document so its
  // plan templates can be configured the same way as the template-detail form.
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >();
  const onSelectedTemplateIdChange = useCallback(
    (templateId: string | undefined) => setSelectedTemplateId(templateId),
    []
  );
  const {
    data: selectedTemplate,
    isLoading,
    isError,
  } = useGetTemplate({
    user,
    templateId: selectedTemplateId ?? '',
    enabled: Boolean(selectedTemplateId),
  });

  const plans = usePlanConfigs({
    planTemplates: selectedTemplate?.uiSpecification?.planTemplates ?? [],
    uiSpec: selectedTemplate?.uiSpecification?.uiSpec,
    isLoading: Boolean(selectedTemplateId) && isLoading,
    isError: Boolean(selectedTemplateId) && isError,
  });

  // Setup form fields follow the chosen template the same way plan configs do
  const setupForm =
    selectedTemplate?.uiSpecification?.uiSpec?.settings?.setupForm;
  const setupGate = setupForm ? setupSubmissionGate(setupForm) : undefined;

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
      onChange: value =>
        onSelectedTemplateIdChange(
          typeof value === 'string' && value ? value : undefined
        ),
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

  if (showTeamDropdown) {
    fields.push(
      buildTeamField({
        canCreateGlobally,
        possibleTeams,
        label: `Create ${config.notebookName} in this team`,
        description: canCreateGlobally
          ? `Choose a team for this ${config.notebookName}, or select "No team".`
          : `Choose a team for this ${config.notebookName}.`,
      })
    );
    dividers.push({index: 4, component: <div className="h-5" />});
  }

  if (setupForm) {
    dividers.push({index: fields.length, component: <SetupFormHeading />});
    fields.push(...setupFieldsToFormFields(setupForm));
  }

  const withPlans = plans.appendTo({fields, dividers});

  interface onSubmitProps {
    name: string;
    description?: string;
    team?: string;
    template?: string;
    file?: File;
    [key: string]: unknown;
  }

  /**
   * Handles the form submission
   *
   * @param {onSubmitProps} values - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async (values: onSubmitProps) => {
    const {name, description, template, file, team} = values;
    const chosenTeamId = resolveTeamId({
      canCreateGlobally,
      specifiedTeam,
      possibleTeams,
      team,
    });
    let response;
    if (template) {
      // Create from selected template
      response = await createProjectFromTemplate({
        user,
        name,
        description,
        template,
        teamId: chosenTeamId,
        planConfigs: plans.toPlanConfigs(values),
        setupValues: setupForm
          ? collectSetupValues(setupForm, values)
          : undefined,
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
        teamId: chosenTeamId,
      });
    }

    if (!response.ok) {
      const json = await response.json().catch(() => undefined);
      return {
        type: 'submit',
        message: errorMessageFromNotebookJsonBody(
          json,
          `Error creating ${config.notebookName}`
        ),
      };
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
    <div className="flex flex-col gap-4">
      {showTeamCallout && (
        <TemplateOwnerCallout
          heading={`${config.notebookNameCapitalized} will be created in`}
          teamName={possibleTeams[0].name}
        />
      )}
      <Form
        fields={withPlans.fields}
        dividers={withPlans.dividers}
        onSubmit={onSubmit}
        submitButtonText={`Create ${config.notebookNameCapitalized}`}
        submitButtonTestId="web-projects-create-submit"
        // pass in team ID default, if provided
        defaultValues={{team: defaultValues?.teamId}}
        footer={plans.footer}
        // A plan config that is not ready is a hard block. Required setup
        // fields validate on submit; only multiselects gate here.
        disableSubmission={
          plans.gate ??
          (setupGate
            ? {
                disabled: data => setupGate.isBlocked(data),
                reason: setupGate.reason,
              }
            : undefined)
        }
      />
    </div>
  );
}
