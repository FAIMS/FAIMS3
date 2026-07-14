import {User} from '@/context/auth-provider';
import {
  GetTemplateSurveyReferencesResponseSchema,
  type GetTemplateSurveyReferencesResponse,
} from '@faims3/data-model';
import {config} from '@/constants';

export function errorMessageFromTemplateJsonBody(
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
 * GET /api/templates/:templateId/references
 */
export const getTemplateSurveyReferences = async ({
  user,
  templateId,
}: {
  user: User;
  templateId: string;
}): Promise<GetTemplateSurveyReferencesResponse> => {
  const response = await fetch(
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}/references`,
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      errorMessageFromTemplateJsonBody(json, response.statusText)
    );
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
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}/delete`,
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
  return await fetch(`${config.apiUrl}/api/templates/`, {
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

/** PUT /api/templates/:templateId — merge name and/or description only. */
export const updateTemplateRequest = async ({
  user,
  templateId,
  name,
  description,
}: {
  user: User;
  templateId: string;
  name?: string;
  description?: string;
}) => {
  return await fetch(
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        ...(name !== undefined && {name}),
        ...(description !== undefined && {description}),
      }),
    }
  );
};

/** PUT /api/templates/:templateId/uiSpecification — full design bundle replace. */
export const updateTemplateUiSpecificationRequest = async ({
  user,
  templateId,
  uiSpecification,
}: {
  user: User;
  templateId: string;
  uiSpecification: unknown;
}) =>
  await fetch(
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}/uiSpecification`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify(uiSpecification),
    }
  );

/** PUT /api/templates/:templateId/team — change owning team only. */
export const modifyTeamForTemplate = async ({
  templateId,
  teamId,
  user,
}: {
  templateId: string;
  teamId: string;
  user: User;
}) =>
  await fetch(
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}/team`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({teamId}),
    }
  );

/**
 * PUT /api/templates/:templateId/visibility — public visibility only.
 */
export const putTemplateSetVisibility = async ({
  user,
  templateId,
  isPublic,
}: {
  user: User;
  templateId: string;
  isPublic: boolean;
}): Promise<void> => {
  const response = await fetch(
    `${config.apiUrl}/api/templates/${encodeURIComponent(templateId)}/visibility`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({isPublic}),
    }
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      errorMessageFromTemplateJsonBody(json, response.statusText)
    );
  }
};
