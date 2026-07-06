import {Field, Form} from '@/components/form';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeams, useGetTemplate} from '@/hooks/queries';
import {Route} from '@/routes/_protected/templates/$templateId';
import {Action, PostCreateNotebookInput} from '@faims3/data-model';
import {
  optionalRootDescriptionField,
  rootDescriptionForApi,
} from '@/lib/rootDescriptionField';
import {ROOT_DESCRIPTION_MAX_LENGTH} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useMemo} from 'react';
import {z} from 'zod';
import {TemplateOwnerCallout} from './template-owner-callout';
import {
  buildTeamField,
  defaultTeamFromOwner,
  getPossibleTeamsForAction,
  getTeamFieldState,
  resolveTeamId,
} from './template-team-field';

interface CreateProjectFromTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Form for creating a notebook from a template on the template detail page.
 *
 * Team selection mirrors other create flows ({@link getTeamFieldState}). When
 * the template has `ownedByTeamId` and the user may create projects in that
 * team, the dropdown defaults to that team; global creators can clear it to
 * create outside any team.
 *
 * @param {CreateProjectFromTemplateFormProps} props - The props for the form.
 * @returns {JSX.Element | null} The rendered form, or null if unauthenticated.
 */
export function CreateProjectFromTemplateForm({
  setDialogOpen,
}: CreateProjectFromTemplateFormProps) {
  const {user, refreshToken} = useAuth();
  if (!user) return null;

  const {templateId} = Route.useParams();

  const queryClient = useQueryClient();

  const {data: teamsData} = useGetTeams({user});
  const {data: template} = useGetTemplate({user, templateId});

  /** `CREATE_PROJECT` — may omit teamId on POST /api/notebooks. */
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});

  const possibleTeams = getPossibleTeamsForAction({
    teams: teamsData?.teams,
    canCreateGlobally,
    createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
    decodedToken: user.decodedToken,
  });

  const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
    canCreateGlobally,
    possibleTeams,
  });

  // Pre-select template owner when accessible; see defaultTeamFromOwner.
  const defaultTeamId = defaultTeamFromOwner({
    ownerTeamId: template?.ownedByTeamId,
    possibleTeams,
  });

  const teamLabel = `Create ${NOTEBOOK_NAME} in this team${
    canCreateGlobally ? ' (optional)' : ''
  }`;

  const teamDescription = canCreateGlobally
    ? defaultTeamId
      ? `Defaults to the template's team. Clear the selection to create outside any team.`
      : `Choose a team for this ${NOTEBOOK_NAME}, or leave blank to create outside any team.`
    : undefined;

  const fields = useMemo(() => {
    const result: Field[] = [
      {
        name: 'name',
        label: `${NOTEBOOK_NAME_CAPITALIZED} Name`,
        schema: z.string().min(5, {
          message: `${NOTEBOOK_NAME_CAPITALIZED} name must be at least 5 characters.`,
        }),
      },
      optionalRootDescriptionField({
        helperText: `Optional summary of this ${NOTEBOOK_NAME} (up to ${ROOT_DESCRIPTION_MAX_LENGTH} characters)`,
      }),
    ];

    if (showTeamDropdown) {
      result.push(
        buildTeamField({
          canCreateGlobally,
          possibleTeams,
          label: teamLabel,
          description: teamDescription,
        })
      );
    }

    return result;
  }, [
    canCreateGlobally,
    possibleTeams,
    showTeamDropdown,
    teamDescription,
    teamLabel,
  ]);

  const onSubmit = async ({
    name,
    description,
    team,
  }: {
    name: string;
    description?: string;
    team?: string;
  }) => {
    const chosenTeamId = resolveTeamId({
      canCreateGlobally,
      possibleTeams,
      team,
    });

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/notebooks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          template_id: templateId,
          name,
          ...rootDescriptionForApi(description),
          ...(chosenTeamId ? {teamId: chosenTeamId} : {}),
        } satisfies PostCreateNotebookInput),
      }
    );

    if (!response.ok)
      return {type: 'submit', message: `Error creating ${NOTEBOOK_NAME}.`};

    // Creator is granted PROJECT_ADMIN server-side; refresh JWT so list APIs
    // include the new notebook (same as CreateProjectForm).
    const {message, status} = await refreshToken();
    if (status === 'error') {
      console.error(
        `${NOTEBOOK_NAME_CAPITALIZED} created but failed to refresh user token:`,
        message
      );
    }

    await queryClient.invalidateQueries({queryKey: ['projects']});
    if (chosenTeamId) {
      await queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
    }

    setDialogOpen(false);
  };

  const calloutTeamName = showTeamCallout ? possibleTeams[0]?.name : undefined;

  return (
    <div className="flex flex-col gap-4">
      {showTeamCallout && calloutTeamName ? (
        <TemplateOwnerCallout
          heading={`${NOTEBOOK_NAME_CAPITALIZED} will be created in`}
          teamName={calloutTeamName}
        />
      ) : null}
      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText={`Create ${NOTEBOOK_NAME_CAPITALIZED}`}
        defaultValues={defaultTeamId ? {team: defaultTeamId} : undefined}
      />
    </div>
  );
}
