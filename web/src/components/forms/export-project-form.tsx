import {z} from 'zod';
import {Form} from '../form';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useAuth} from '@/context/auth-provider';
import {useGetProjects} from '@/hooks/get-hooks';

interface ExportProjectFormProps {
  type: 'csv' | 'json' | 'xlsx';
}

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 *
 * @param {'csv' | 'json' | 'xlsx'} type - The type of file to download.
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
    if (type === 'json') {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user!.token}`,
          },
        }
      );

      if (!response.ok)
        return {type: 'submit', message: 'Error getting JSON data.'};

      const {records} = await response.json();
      const filteredRecords = records.filter(
        (record: any) => record.type === form
      );

      const blob = new Blob([JSON.stringify(filteredRecords, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_${form}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      const url = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/${form}.${type}`;
      window.open(url, '_blank');
    }
    return undefined;
  };

  return <Form fields={fields} onSubmit={onSubmit} />;
};

export default ExportProjectForm;
