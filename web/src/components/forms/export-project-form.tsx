import {z} from 'zod';
import {Form} from '../form';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 *
 * @returns {JSX.Element} The rendered ExportProjectForm component.
 */
const ExportProjectForm = ({type} : {type: 'zip' | 'csv'}) => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});

  const fields = [
    {
      name: 'form',
      label: 'Form',
      schema: z.string().nonempty(),
      options:
        data && data['ui-specification']?.viewsets
          ? Object.keys(data['ui-specification']?.viewsets).map(name => ({
              label: name,
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
    window.open(
      `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/${form}.${type}`,
      '_blank'
    );
    return undefined;
  };

  return <Form fields={fields} onSubmit={onSubmit} />;
};

export default ExportProjectForm;
