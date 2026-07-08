import {useAuth} from '@/context/auth-provider';
import {Field, Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetTeams} from '@/hooks/queries';
import {useIsAuthorisedTo, useCanCreateTemplate} from '@/hooks/auth-hooks';
import {
  Action,
  prepareNotebookUiSpecificationInputForApi,
} from '@faims3/data-model';

import blankNotebook from '../../../notebooks/blank-notebook.json';
import {NOTEBOOK_NAME} from '@/constants';
import {
  optionalRootDescriptionField,
  rootDescriptionForApi,
} from '@/lib/rootDescriptionField';
import {TemplateOwnerCallout} from './template-owner-callout';
import {
  buildTemplateTeamField,
  getPossibleTeamsForAction,
  getTemplateTeamFieldState,
  resolveTemplateTeamId,
} from './template-team-field';

interface CreateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  specifiedTeam?: string;
}

/**
 * CreateTemplateForm component renders a form for creating a template.
 *
 * Team UI follows {@link getTeamFieldState}: a callout when the user must
 * create in their only team, or an optional/required dropdown when they have
 * a choice. Global creators (`CREATE_TEMPLATE`) may omit team ownership.
 *
 * @param {CreateTemplateFormProps} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateTemplateForm component.
 */
export function CreateTemplateForm({
  setDialogOpen,
  defaultValues,
  specifiedTeam = undefined,
}: CreateTemplateFormProps) {
  const {user, refreshToken} = useAuth();
  const queryClient = useQueryClient();
  const {data: teams} = useGetTeams({user});

  const canCreateTemplate = useCanCreateTemplate();

  /** `CREATE_TEMPLATE` — may omit teamId on POST /api/templates. */
  const canCreateGlobally = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE,
  });

  const canCreatePublicTemplate = useIsAuthorisedTo({
    action: Action.CREATE_PUBLIC_TEMPLATE,
  });

  const possibleTeams = getPossibleTeamsForAction({
    teams: teams?.teams,
    canCreateGlobally,
    createInTeamAction: Action.CREATE_TEMPLATE_IN_TEAM,
    decodedToken: user?.decodedToken,
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
      schema: z.string().min(5, {
        message: 'Template name must be at least 5 characters.',
      }),
    },
    optionalRootDescriptionField(),
    {
      name: 'file',
      label: 'JSON File (optional — leave blank to create a blank template)',
      description: `Upload a .json ${NOTEBOOK_NAME} file to pre-fill your template, or leave blank to use our built-in sample.`,
      type: 'file',
      schema: z
        .instanceof(File)
        .refine(f => f.type === 'application/json', {
          message: 'Only JSON files are allowed.',
        })
        .optional(),
    },
  ];

  if (canCreatePublicTemplate) {
    fields.push({
      name: 'visibility',
      label: 'Template visibility',
      description:
        'Public templates are available for all signed-in users who can browse templates.',
      options: [
        {
          label: 'Private',
          value: 'private',
          description:
            'Only people with access (for example your team) can view this template.',
        },
        {
          label: 'Public',
          value: 'public',
          description:
            'This template will be available to view and use for all users. Public permissions are read only.',
        },
      ],
      schema: z.enum(['private', 'public']),
    });
  }

  if (showTeamDropdown) {
    fields.push(buildTemplateTeamField({canCreateGlobally, possibleTeams}));
  }

  const onSubmit = async (values: {
    name: string;
    description?: string;
    file?: File;
    team?: string;
    visibility?: 'private' | 'public';
  }) => {
    if (!user) return {type: 'submit', message: 'Not authenticated'};

    const {name, description, file, team, visibility} = values;
    const isPublic = canCreatePublicTemplate && visibility === 'public';
    let uiSpecification: unknown = blankNotebook;

    if (file) {
      const text = await readFileAsText(file);
      if (!text) {
        return {type: 'submit', message: 'Error reading file'};
      }
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
    }

    const chosenTeamId = resolveTemplateTeamId({
      canCreateGlobally,
      specifiedTeam,
      possibleTeams,
      team,
    });

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
            teamId: chosenTeamId,
            name,
            ...rootDescriptionForApi(description),
            isPublic,
            uiSpecification,
          }),
        }
      );
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
        defaultValues={{
          team: defaultValues?.teamId,
          ...(canCreatePublicTemplate ? {visibility: 'private' as const} : {}),
        }}
      />
    </div>
  );
}
