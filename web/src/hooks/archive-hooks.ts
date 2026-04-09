import {useAuth} from '@/context/auth-provider';
import {
  postDeleteArchivedNotebook,
  postRestoreArchivedNotebook,
  putNotebookArchive,
} from '@/hooks/project-hooks';
import {postDeleteArchivedTemplate} from '@/hooks/template-hooks';
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

type ArchiveProjectArgs = {
  projectId: string;
};

type DeleteArchivedProjectArgs = {
  projectId: string;
  confirmName: string;
};

/**
 * Permanently deletes an archived notebook via POST /api/notebooks/:id/delete.
 */
export function useDeleteArchivedProject() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({
      projectId,
      confirmName,
    }: DeleteArchivedProjectArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDeleteArchivedNotebook({user, projectId, confirmName});
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.removeQueries({queryKey: ['projects', projectId]});
    },
  });
}

/**
 * Restores an archived notebook via POST /api/notebooks/:id/restore.
 */
export function useRestoreArchivedProject() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({projectId}: {projectId: string}) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postRestoreArchivedNotebook({user, projectId});
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });
}

/**
 * Archives a notebook via PUT /api/notebooks/:id/archive.
 */
export function useArchiveProject() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({projectId}: ArchiveProjectArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putNotebookArchive({user, projectId, archive: true});
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });
}

/**
 * Permanently deletes an archived template via POST /api/templates/:id/delete.
 */
export function useDeleteArchivedTemplate() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({templateId}: {templateId: string}) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDeleteArchivedTemplate({user, templateId});
    },
    onSuccess: (_data, {templateId}) => {
      queryClient.invalidateQueries({queryKey: ['templates']});
      queryClient.invalidateQueries({queryKey: ['templates', templateId]});
      queryClient.invalidateQueries({queryKey: ['templatesbyteam']});
    },
  });
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
