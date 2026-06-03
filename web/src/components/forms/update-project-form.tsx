import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  errorMessageFromNotebookJsonBody,
  updateNotebookUiSpecificationRequest,
} from '@/hooks/project-hooks';
import {prepareNotebookUiSpecificationInputForApi} from '@faims3/data-model';

const fields = [
  {
    name: 'file',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

/**
 * UpdateProjectForm replaces the project notebook design via PUT
 * /api/notebooks/:projectId/uiSpecification. Accepts legacy or current
 * notebook JSON (same loose validation as create-from-file).
 */
export function UpdateProjectForm({
  setDialogOpen,
  onSuccess,
}: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSuccess: () => void;
}) {
  const {user} = useAuth();
  const {projectId} = Route.useParams();

  const onSubmit = async ({file}: {file: File}) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    const jsonString = await readFileAsText(file);

    if (!jsonString) return {type: 'submit', message: 'Error reading file'};

    let payload: unknown;
    try {
      payload = JSON.parse(jsonString);
    } catch {
      return {type: 'submit', message: 'Invalid JSON file'};
    }

    const prepared = prepareNotebookUiSpecificationInputForApi(payload);
    if (!prepared.ok) {
      return {type: 'submit', message: prepared.message};
    }

    const uiResponse = await updateNotebookUiSpecificationRequest({
      user,
      projectId,
      uiSpecification: prepared.uiSpecification,
    });
    if (!uiResponse.ok) {
      const json: unknown = await uiResponse.json().catch(() => undefined);
      return {
        type: 'submit',
        message:
          'Error updating project design: ' +
          errorMessageFromNotebookJsonBody(json, uiResponse.statusText),
      };
    }

    onSuccess();
    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Replace ${NOTEBOOK_NAME_CAPITALIZED} JSON`}
      submitButtonVariant="destructive"
      warningMessage={
        "If the project's response format has changed, there will be inconsistences in responses."
      }
    />
  );
}
