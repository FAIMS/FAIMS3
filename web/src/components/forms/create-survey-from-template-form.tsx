import {useAuth} from '@/auth';
import {Form} from '@/components/form';
import {Route} from '@/routes/_auth/templates/$templateId';
import {useRouter} from '@tanstack/react-router';
import {z} from 'zod';

export const fields = [
  {
    name: 'name',
    label: 'Survey Name',
    schema: z
      .string()
      .min(3, {message: 'Survey name must be at least 3 characters.'}),
  },
];

/**
 * Component for rendering a form to create a survey from a template.
 * @returns {JSX.Element} The rendered form component.
 */
export function CreateSurveyFromTemplateForm() {
  const {user} = useAuth();
  if (!user) return null;

  const {templateId} = Route.useParams();
  const router = useRouter();

  /**
   * Handles form submission for creating a survey.
   * @param {{name: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name}: {name: string}) => {
    const response = await fetch(`http://localhost:8080/api/notebooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        template_id: templateId,
        name,
      }),
    });

    if (!response.ok) return {type: 'submit', message: 'Error creating survey'};

    const json = await response.json();

    await router.navigate({to: `/surveys/${json.notebook}`});
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Create Survey"
    />
  );
}
