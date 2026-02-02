import {useAuth} from '@/context/auth-provider';
import {Field, Form} from '@/components/form';
import {z} from 'zod';
import {useQueryClient} from '@tanstack/react-query';
import {useGetProject, useGetTeams} from '@/hooks/queries';
import {useIsAuthorisedTo, userCanDo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';

interface CreateTemplateFromProjectForm {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues?: {teamId?: string};
  projectId: string;
  specifiedTeam?: string;
}

/**
 * CreateTemplateForm component renders a form for creating a template.
 * It provides a button to open the dialog and a form to create the template.
 *
 * @param {CreateTemplateFromProjectForm} props - The props for the form.
 * @returns {JSX.Element} The rendered CreateTemplateForm component.
 */
export function CreateTemplateFromProjectForm({
  setDialogOpen,
  defaultValues,
  projectId,
  specifiedTeam = undefined,
}: CreateTemplateFromProjectForm) {
  const {user, refreshToken} = useAuth();
  const queryClient = useQueryClient();
  const {data: teams} = useGetTeams({user});
  const {data: projectData} = useGetProject({user, projectId});

  // can they create projects outside team?
  const canCreateGlobally = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE,
  });

  // filter teams by those we can create templates in
  const possibleTeams = teams?.teams.filter(team => {
    return (
      user &&
      userCanDo({
        user,
        action: Action.CREATE_TEMPLATE_IN_TEAM,
        resourceId: team._id,
      })
    );
  });
  const justOneTeam = specifiedTeam || possibleTeams?.length === 1;

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Template Name',
      description: 'A short display name for the template',
      schema: z.string().min(5, {
        message: 'Template name must be at least 5 characters.',
      }),
    },
  ];

  if (!justOneTeam) {
    fields.push({
      name: 'team',
      label: `Team${canCreateGlobally ? ' (optional)' : ''}`,
      options: possibleTeams?.map(({_id, name}) => ({
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

    const {name, team} = values;

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
            ...projectData,
            teamId: team ?? specifiedTeam,
            name,
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
    if (specifiedTeam || team) {
      await queryClient.invalidateQueries({
        queryKey: ['templatesbyteam', specifiedTeam || team],
      });
    }
    await queryClient.invalidateQueries({queryKey: ['templates', undefined]});
    setDialogOpen(false);
  };

  return (
    <>
      {possibleTeams?.length === 1 && (
        <span>
          <strong>Template will be owned by:</strong> {possibleTeams[0].name}
        </span>
      )}
      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText="Create Template"
        defaultValues={{team: defaultValues?.teamId}}
      />
    </>
  );
}
