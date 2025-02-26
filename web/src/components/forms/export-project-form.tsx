import {z} from 'zod';
import {Form} from '../form';
import {downloadFile} from '@/lib/utils';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/get-hooks';

interface ExportProjectFormProps {
  type: 'csv' | 'zip';
}

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 *
 * @param {'csv' | 'zip'} type - The type of file to download.
 * @returns {JSX.Element} The rendered ExportProjectForm component.
 */
const ExportProjectForm = ({type}: ExportProjectFormProps) => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProjects(user, projectId);

  const fields = [
    {
      name: 'form',
      label: 'Form',
      schema: z.string().nonempty(),
      options: Object.keys(data['ui-specification'].viewsets).map(name => ({
        label: name,
        value: name,
      })),
    },
  ];

  /**
   * Handles the form submission
   *
   * @param {{form: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string}>} The result of the form submission.
   */
  const onSubmit = async ({form}: {form: string}) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/${form}.${type}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user!.token}`,
        },
      }
    );

    if (!response.ok)
      return {type: 'submit', message: 'Error downloading File.'};

    downloadFile(await response.blob(), `${projectId}_${form}.${type}`);
  };

  return <Form fields={fields} onSubmit={onSubmit} />;
};

export default ExportProjectForm;
