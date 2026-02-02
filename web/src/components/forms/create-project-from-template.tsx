import {Form} from '@/components/form';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeams} from '@/hooks/queries';
import {Route} from '@/routes/_protected/templates/$templateId';
import {Action, PostCreateNotebookInput} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useMemo} from 'react';
import {z} from 'zod';

interface CreateProjectFromTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Component for rendering a form to create a project from a template.
 * @returns {JSX.Element} The rendered form component.
 */
export function CreateProjectFromTemplateForm({
  setDialogOpen,
}: CreateProjectFromTemplateFormProps) {
  const {user} = useAuth();
  if (!user) return null;

  const {templateId} = Route.useParams();

  const QueryClient = useQueryClient();

  const {data: teams} = useGetTeams({user});
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});

  const fields = useMemo(
    () => [
      {
        name: 'name',
        label: `${NOTEBOOK_NAME_CAPITALIZED} Name`,
        schema: z.string().min(5, {
          message: `${NOTEBOOK_NAME_CAPITALIZED} name must be at least 5 characters.`,
        }),
      },
      {
        name: 'team',
        label: `Create ${NOTEBOOK_NAME} in this team${canCreateGlobally && ' (optional)'}`,
        options: teams?.teams.map(({_id, name}) => ({
          label: name,
          value: _id,
        })),
        schema: canCreateGlobally ? z.string().optional() : z.string(),
      },
    ],
    [teams, canCreateGlobally]
  );

  /**
   * Handles form submission for creating a project.
   * @param {{name: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name, team}: {name: string; team?: string}) => {
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
          ...(team ? {teamId: team} : {}),
        } satisfies PostCreateNotebookInput),
      }
    );

    if (!response.ok)
      return {type: 'submit', message: `Error creating ${NOTEBOOK_NAME}.`};

    QueryClient.invalidateQueries({queryKey: ['projects', undefined]});

    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Create ${NOTEBOOK_NAME_CAPITALIZED}`}
    />
  );
}
