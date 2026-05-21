import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME} from '@/constants';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  errorMessageFromNotebookJsonBody,
  modifyTeamForProject,
  updateNotebookMetadataRequest,
  updateNotebookUiSpecificationRequest,
} from '@/hooks/project-hooks';

const fields = [
  {
    name: 'file',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

function teamIdFromUpload(
  payload: Record<string, unknown>
): string | undefined {
  if (typeof payload.teamId === 'string' && payload.teamId.trim().length > 0) {
    return payload.teamId.trim();
  }
  if (
    typeof payload.ownedByTeamId === 'string' &&
    payload.ownedByTeamId.trim().length > 0
  ) {
    return payload.ownedByTeamId.trim();
  }
  return undefined;
}

/**
 * UpdateProjectForm uploads a project JSON export and applies it via the split
 * API routes (metadata, team, uiSpecification).
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

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      return {type: 'submit', message: 'Invalid JSON file'};
    }

    const reportError = async (response: Response, label: string) => {
      const json: unknown = await response.json().catch(() => undefined);
      return {
        type: 'submit' as const,
        message:
          `${label}: ` +
          errorMessageFromNotebookJsonBody(json, response.statusText),
      };
    };

    const teamId = teamIdFromUpload(payload);
    if (teamId) {
      const teamResponse = await modifyTeamForProject({
        projectId,
        teamId,
        user,
      });
      if (!teamResponse.ok) {
        return reportError(teamResponse, 'Error updating project team');
      }
    }

    const name = typeof payload.name === 'string' ? payload.name : undefined;
    const description =
      typeof payload.description === 'string' ? payload.description : undefined;
    if (name !== undefined || description !== undefined) {
      const metaResponse = await updateNotebookMetadataRequest({
        user,
        projectId,
        name,
        description,
      });
      if (!metaResponse.ok) {
        return reportError(metaResponse, 'Error updating project details');
      }
    }

    const uiSpecification =
      payload.uiSpecification ?? payload['ui-specification'];
    if (uiSpecification !== undefined && uiSpecification !== null) {
      const uiResponse = await updateNotebookUiSpecificationRequest({
        user,
        projectId,
        uiSpecification,
      });
      if (!uiResponse.ok) {
        return reportError(uiResponse, 'Error updating project design');
      }
    }

    if (
      teamId === undefined &&
      name === undefined &&
      description === undefined &&
      (uiSpecification === undefined || uiSpecification === null)
    ) {
      return {
        type: 'submit',
        message:
          'JSON must include at least one of: teamId, ownedByTeamId, name, description, uiSpecification',
      };
    }

    onSuccess();
    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Update ${NOTEBOOK_NAME}`}
      submitButtonVariant="destructive"
      warningMessage={
        "If the project's response format has changed, there will be inconsistences in responses."
      }
    />
  );
}
