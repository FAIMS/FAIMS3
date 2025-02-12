import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {Route} from '@/routes/templates/$templateId';
import {useRouter} from '@tanstack/react-router';
import {z} from 'zod';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

export const fields = [
  {
    name: 'name',
    label: `${NOTEBOOK_NAME_CAPITALIZED} Name`,
    schema: z.string().min(5, {
      message: `${NOTEBOOK_NAME_CAPITALIZED} name must be at least 5 characters.`,
    }),
  },
];

/**
 * Component for rendering a form to create a project from a template.
 * @returns {JSX.Element} The rendered form component.
 */
export function CreateProjectFromTemplateForm() {
  const {user} = useAuth();
  if (!user) return null;

  const {templateId} = Route.useParams();
  const router = useRouter();

  /**
   * Handles form submission for creating a project.
   * @param {{name: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name}: {name: string}) => {
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
        }),
      }
    );

    if (!response.ok)
      return {type: 'submit', message: `Error creating ${NOTEBOOK_NAME}.`};

    const json = await response.json();

    await router.navigate({to: `/${NOTEBOOK_NAME}s/${json.notebook}`});
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Create ${NOTEBOOK_NAME_CAPITALIZED}`}
    />
  );
}
