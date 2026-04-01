import {useAuth} from '@/context/auth-provider';
import {
  PostRestoreTemplateResponseSchema,
  type PostRestoreTemplateResponse,
} from '@faims3/data-model';
import {useMutation, useQueryClient} from '@tanstack/react-query';

type RestoreTemplateArgs = {
  templateId: string;
};

async function postRestoreTemplateRequest({
  templateId,
  token,
}: {
  templateId: string;
  token: string;
}): Promise<PostRestoreTemplateResponse> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${templateId}/restore`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    }
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      json &&
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
        ? (json as {error: {message: string}}).error.message
        : response.statusText;
    throw new Error(message);
  }
  return PostRestoreTemplateResponseSchema.parse(json);
}

/**
 * Restores an archived template via POST /api/templates/:id/restore.
 */
export function useRestoreTemplateFromArchive() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({templateId}: RestoreTemplateArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      return postRestoreTemplateRequest({
        templateId,
        token: user.token,
      });
    },
    onSuccess: (_data, {templateId}) => {
      queryClient.invalidateQueries({queryKey: ['templates']});
      queryClient.invalidateQueries({queryKey: ['templates', templateId]});
      queryClient.invalidateQueries({queryKey: ['templatesbyteam']});
    },
  });
}

/** Placeholder for team restore — implement when teams support archive listing. */
export function useRestoreTeamFromArchive() {
  return useMutation({
    mutationFn: async (_args: {teamId: string}) => {
      await Promise.resolve();
      throw new Error('Restore team from archive is not implemented yet.');
    },
  });
}

/** Placeholder for user restore — implement when users support archive listing. */
export function useRestoreUserFromArchive() {
  return useMutation({
    mutationFn: async (_args: {userId: string}) => {
      await Promise.resolve();
      throw new Error('Restore user from archive is not implemented yet.');
    },
  });
}

/** Placeholder for survey/notebook restore — implement when surveys support archive listing. */
export function useRestoreSurveyFromArchive() {
  return useMutation({
    mutationFn: async (_args: {surveyId: string}) => {
      await Promise.resolve();
      throw new Error('Restore survey from archive is not implemented yet.');
    },
  });
}
