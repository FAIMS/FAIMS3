import {useAuth} from '@/context/auth-provider';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {z} from 'zod';
import {NOTEBOOK_NAME} from '@/constants';
import {Route} from '@/routes/_protected/templates/$templateId';
import {
  errorMessageFromTemplateJsonBody,
  modifyTeamForTemplate,
  updateTemplateRequest,
  updateTemplateUiSpecificationRequest,
} from '@/hooks/template-hooks';

export const fields = [
  {
    name: 'file',
    type: 'file',
    schema: z.instanceof(File).refine(file => file.type === 'application/json'),
  },
];

interface UpdateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSuccess: () => void;
}

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
 * UpdateTemplateForm uploads a template JSON export and applies it via the
 * split API routes (metadata, team, uiSpecification).
 */
export function UpdateTemplateForm({
  setDialogOpen,
  onSuccess,
}: UpdateTemplateFormProps) {
  const {user} = useAuth();
  const {templateId} = Route.useParams();

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
          errorMessageFromTemplateJsonBody(json, response.statusText),
      };
    };

    const teamId = teamIdFromUpload(payload);
    if (teamId) {
      const teamResponse = await modifyTeamForTemplate({
        templateId,
        teamId,
        user,
      });
      if (!teamResponse.ok) {
        return reportError(teamResponse, 'Error updating template team');
      }
    }

    const name = typeof payload.name === 'string' ? payload.name : undefined;
    const description =
      typeof payload.description === 'string' ? payload.description : undefined;
    if (name !== undefined || description !== undefined) {
      const metaResponse = await updateTemplateRequest({
        user,
        templateId,
        name,
        description,
      });
      if (!metaResponse.ok) {
        return reportError(metaResponse, 'Error updating template details');
      }
    }

    const uiSpecification =
      payload.uiSpecification ?? payload['ui-specification'];
    if (uiSpecification !== undefined && uiSpecification !== null) {
      const uiResponse = await updateTemplateUiSpecificationRequest({
        user,
        templateId,
        uiSpecification,
      });
      if (!uiResponse.ok) {
        return reportError(uiResponse, 'Error updating template design');
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
      submitButtonText="Upload Template JSON"
      submitButtonVariant="destructive"
      warningMessage={`Editing the template does not change any of the ${NOTEBOOK_NAME}s created from it.  This may create inconsistencies in your data.`}
    />
  );
}
