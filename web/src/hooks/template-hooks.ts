import {User} from '@/context/auth-provider';
import {
  GetTemplateSurveyReferencesResponseSchema,
  type GetTemplateSurveyReferencesResponse,
} from '@faims3/data-model';

function errorMessageFromTemplateJsonBody(
  json: unknown,
  fallbackStatusText: string
): string {
  if (
    json &&
    typeof json === 'object' &&
    json !== null &&
    'error' in json &&
    typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
  ) {
    return (json as {error: {message: string}}).error.message;
  }
  return fallbackStatusText;
}

/**
 * GET /api/templates/:templateId/survey-references
 */
export const getTemplateSurveyReferences = async ({
  user,
  templateId,
}: {
  user: User;
  templateId: string;
}): Promise<GetTemplateSurveyReferencesResponse> => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${encodeURIComponent(templateId)}/survey-references`,
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(errorMessageFromTemplateJsonBody(json, response.statusText));
  }
  return GetTemplateSurveyReferencesResponseSchema.parse(json);
};

/**
 * POST /api/templates/:templateId/delete — permanently delete an archived template.
 */
export const postDeleteArchivedTemplate = async ({
  user,
  templateId,
}: {
  user: User;
  templateId: string;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${encodeURIComponent(templateId)}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
  if (response.ok) {
    return;
  }
  const json: unknown = await response.json().catch(() => undefined);
  throw new Error(errorMessageFromTemplateJsonBody(json, response.statusText));
};

export const createTemplateRequest = async ({
  user,
  name,
  teamId,
  templateData,
}: {
  user: User;
  name: string;
  teamId: string;
  templateData: any;
}) => {
  return await fetch(`${import.meta.env.VITE_API_URL}/api/templates/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      ...templateData,
      teamId,
      name,
    }),
  });
};

export const updateTemplateRequest = async ({
  user,
  templateId,
  name,
  teamId,
  templateData,
}: {
  user: User;
  templateId: string;
  name?: string;
  teamId?: string;
  templateData?: {metadata: any; 'ui-specification': any};
}) => {
  return await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${templateId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        ...templateData,
        teamId,
        name,
      }),
    }
  );
};
