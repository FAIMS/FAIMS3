// SPDX-License-Identifier: Apache-2.0
import {useAuth} from '@/context/auth-provider';
import {
  postDeleteArchivedNotebook,
  putNotebookStatus,
} from '@/hooks/project-hooks';
import {ProjectStatus} from '@faims3/data-model';
import {postDeleteArchivedTemplate} from '@/hooks/template-hooks';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {config} from '@/constants';

type RestoreTemplateArgs = {
  templateId: string;
};

type RestoreTeamArgs = {
  teamId: string;
};

export async function putArchiveTeamRequest({
  teamId,
  token,
  archive,
}: {
  teamId: string;
  token: string;
  archive: boolean;
}): Promise<void> {
  const response = await fetch(
    `${config.apiUrl}/api/teams/${encodeURIComponent(teamId)}/archive`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({archive}),
    }
  );
  if (!response.ok) {
    const json: unknown = await response.json().catch(() => undefined);
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
}

async function postDeleteArchivedTeamRequest({
  teamId,
  token,
}: {
  teamId: string;
  token: string;
}): Promise<void> {
  const response = await fetch(
    `${config.apiUrl}/api/teams/${encodeURIComponent(teamId)}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const json: unknown = await response.json().catch(() => undefined);
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
}

async function putUnarchiveTemplateRequest({
  templateId,
  token,
}: {
  templateId: string;
  token: string;
}): Promise<void> {
  const response = await fetch(
    `${config.apiUrl}/api/templates/${templateId}/archive`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({archive: false}),
    }
  );
  if (!response.ok) {
    const json: unknown = await response.json().catch(() => undefined);
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
    mutationFn: async ({projectId, confirmName}: DeleteArchivedProjectArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDeleteArchivedNotebook({user, projectId, confirmName});
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
      queryClient.removeQueries({queryKey: ['projects', projectId]});
    },
  });
}

/**
 * Restores an archived notebook via PUT /api/notebooks/:id/status (CLOSED).
 */
export function useRestoreArchivedProject() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({projectId}: {projectId: string}) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putNotebookStatus({
        user,
        projectId,
        status: ProjectStatus.CLOSED,
      });
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
      queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });
}

/**
 * Archives a notebook via PUT /api/notebooks/:id/status (ARCHIVED).
 */
export function useArchiveProject() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({projectId}: ArchiveProjectArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putNotebookStatus({
        user,
        projectId,
        status: ProjectStatus.ARCHIVED,
      });
    },
    onSuccess: (_data, {projectId}) => {
      queryClient.invalidateQueries({queryKey: ['projects']});
      queryClient.invalidateQueries({queryKey: ['projectsbyteam']});
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
 * Restores an archived template via PUT /api/templates/:id/archive { archive: false }.
 */
export function useRestoreTemplateFromArchive() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({templateId}: RestoreTemplateArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putUnarchiveTemplateRequest({
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

/**
 * Archives a team via PUT /api/teams/:id/archive { archive: true }.
 */
export function useArchiveTeam() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({teamId}: RestoreTeamArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putArchiveTeamRequest({
        teamId,
        token: user.token,
        archive: true,
      });
    },
    onSuccess: (_data, {teamId}) => {
      queryClient.invalidateQueries({queryKey: ['teams']});
      queryClient.invalidateQueries({queryKey: ['teams', teamId]});
    },
  });
}

/**
 * Permanently deletes an archived team via POST /api/teams/:id/delete.
 */
export function useDeleteArchivedTeam() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({teamId}: RestoreTeamArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await postDeleteArchivedTeamRequest({
        teamId,
        token: user.token,
      });
    },
    onSuccess: (_data, {teamId}) => {
      queryClient.invalidateQueries({queryKey: ['teams']});
      queryClient.removeQueries({queryKey: ['teams', teamId]});
    },
  });
}

/**
 * Restores an archived team via PUT /api/teams/:id/archive { archive: false }.
 */
export function useRestoreTeamFromArchive() {
  const queryClient = useQueryClient();
  const {user} = useAuth();

  return useMutation({
    mutationFn: async ({teamId}: RestoreTeamArgs) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      await putArchiveTeamRequest({
        teamId,
        token: user.token,
        archive: false,
      });
    },
    onSuccess: (_data, {teamId}) => {
      queryClient.invalidateQueries({queryKey: ['teams']});
      queryClient.invalidateQueries({queryKey: ['teams', teamId]});
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
