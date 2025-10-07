import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {ProjectUIViewsets} from '@faims3/data-model';
import {z} from 'zod';
import {Field, Form} from '../form';

/**
 * ExportPhotosForm component renders a form for downloading a project's photos
 * as a ZIP. It allows the user to select which form to export photos from.
 */
const ExportPhotosForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});

  if (!data) {
    return null;
  }

  const viewSets = data['ui-specification'].viewsets as ProjectUIViewsets;

  const fields: Field[] = [
    {
      name: 'form',
      label: 'Form',
      description: 'Select the form to export photos from',
      schema: z.string().min(1, 'Please select a form'),
      options:
        data && data['ui-specification']?.viewsets
          ? Object.keys(viewSets).map(name => ({
              label: viewSets[name].label || name,
              value: name,
            }))
          : [],
    },
  ];

  /**
   * Handles the form submission for photo export
   *
   * @param {{form: string}} params - The submitted form values.
   * @returns {Promise<undefined>} The result of the form submission.
   */
  const onSubmit = async ({form}: {form: string}) => {
    if (user) {
      const downloadURL = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/export?format=zip&viewID=${form}`;

      const response = await fetch(downloadURL, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (response.redirected) window.open(response.url, '_self');
    }
    return undefined;
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Download Photos"
    />
  );
};

export default ExportPhotosForm;
