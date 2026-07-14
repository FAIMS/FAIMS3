import {useAuth} from '@/context/auth-provider';
import {Field, Form} from '@/components/form';
import {resourceNameSchema} from '@/lib/input-limits';
import {INPUT_LIMITS} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useGetProject, useGetTeams} from '@/hooks/queries';
import {
  useIsAuthorisedTo,
  useCanCreateTemplate,
  useRequiredUser,
} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';
import {
  optionalRootDescriptionField,
  rootDescriptionForApi,
} from '@/lib/rootDescriptionField';
import {ROOT_DESCRIPTION_MAX_LENGTH} from '@faims3/data-model';
import {TemplateOwnerCallout} from './template-owner-callout';
import {
  buildTemplateTeamField,
  getPossibleTeamsForAction,
  getTemplateTeamFieldState,
  resolveTemplateTeamId,
} from './template-team-field';
import {config} from '@/constants';

interface CreateTemplateFromProjectForm {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  projectId: string;
  specifiedTeam?: string;
}

/**
 * Form for creating a template from an existing project's UI specification.
 *
 * Uses the same team callout/dropdown rules as {@link CreateTemplateForm}.
 *
 * @param {CreateTemplateFromProjectForm} props - The props for the form.
 * @returns {JSX.Element} The rendered form component.
 */
export function CreateTemplateFromProjectForm({
  setDialogOpen,
  defaultValues,
  projectId,
  specifiedTeam = undefined,
}: CreateTemplateFromProjectForm) {
  const user = useRequiredUser();
  const {refreshToken} = useAuth();
  const queryClient = useQueryClient();
  const {data: teams} = useGetTeams({user});
  const {data: projectData} = useGetProject({user, projectId});

  const canCreateTemplate = useCanCreateTemplate();

  /** `CREATE_TEMPLATE` — may omit teamId on POST /api/templates. */
  const canCreateGlobally = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE,
  });

  const possibleTeams = getPossibleTeamsForAction({
    teams: teams?.teams,
    canCreateGlobally,
    createInTeamAction: Action.CREATE_TEMPLATE_IN_TEAM,
    decodedToken: user.decodedToken,
  });

  const {showTeamCallout, showTeamDropdown} = getTemplateTeamFieldState({
    canCreateGlobally,
    specifiedTeam,
    possibleTeams,
  });

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Template Name',
      description: 'A short display name for the template',
      schema: resourceNameSchema(5, 'Template name'),
      maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
    },
    optionalRootDescriptionField({
      helperText: `Optional; not copied from the survey (up to ${ROOT_DESCRIPTION_MAX_LENGTH} characters)`,
    }),
  ];

  if (showTeamDropdown) {
    fields.push(buildTemplateTeamField({canCreateGlobally, possibleTeams}));
  }

  const onSubmit = async (values: {
    name: string;
    description?: string;
    team?: string;
  }) => {
    const {name, description, team} = values;

    if (!projectData?.uiSpecification) {
      return {
        type: 'submit',
        message: 'Survey design is not loaded; try again.',
      };
    }

    const chosenTeamId = resolveTemplateTeamId({
      canCreateGlobally,
      specifiedTeam,
      possibleTeams,
      team,
    });

    try {
      const res = await fetch(`${config.apiUrl}/api/templates/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name,
          ...rootDescriptionForApi(description),
          uiSpecification: projectData.uiSpecification,
          teamId: chosenTeamId,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      // need to refresh our auth token to get permissions on this new template
      const {message, status} = await refreshToken();
      if (status === 'error') {
        return {
          type: 'submit',
          message: `template created but failed to refresh user token: ${message}`,
        };
      }
    } catch {
      return {type: 'submit', message: 'Failed to create template'};
    }

    // query invalidations
    await queryClient.invalidateQueries({queryKey: ['templates']});
    await queryClient.invalidateQueries({queryKey: ['templatesbyteam']});
    setDialogOpen(false);
  };

  if (!canCreateTemplate) {
    return <p>You do not have permission to create templates.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fixed team — user cannot pick another or opt out. */}
      {showTeamCallout && (
        <TemplateOwnerCallout teamName={possibleTeams[0].name} />
      )}
      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText="Create Template"
        defaultValues={{team: defaultValues?.teamId}}
      />
    </div>
  );
}
