import {z} from 'zod';
import {Form} from '../form';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {ProjectUIViewsets, UISpecification} from '@faims3/data-model';

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 *
 * @returns {JSX.Element} The rendered ExportProjectForm component.
 */
const ExportProjectForm = ({type}: {type: 'zip' | 'csv'}) => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});

  if (!data) {
    return [];
  }

  const viewSets = data['ui-specification'].viewsets as ProjectUIViewsets;

  const fields = [
    {
      name: 'form',
      label: 'Form',
      schema: z.string().nonempty(),
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
   * Handles the form submission
   *
   * @param {{form: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({form}: {form: string}) => {
    if (user) {
      const downloadURL = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/${form}.${type}`;
      const response = await fetch(downloadURL, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });
      // open the download URL in the current window to force the download
      if (response.redirected) window.open(response.url, '_self');
    }
    return undefined;
  };

  return <Form fields={fields} onSubmit={onSubmit} />;
};

export default ExportProjectForm;
