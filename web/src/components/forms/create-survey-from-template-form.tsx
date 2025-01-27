import {Form} from '@/components/form';
import {sleep} from '@/utils';
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
  /**
   * Handles form submission for creating a survey.
   * @param {{name: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({name}: {name: string}) => {
    await sleep(100);

    console.log(name);

    return {type: 'submit', message: 'Error creating survey'};
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Create Survey"
    />
  );
}
