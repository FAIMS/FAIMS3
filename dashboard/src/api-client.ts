import {
  GetNotebookListResponse,
  GetNotebookResponse,
} from '@faims3/data-model';
import {API_URL} from './constants';
import {User} from './auth-context';

async function apiFetch<T>({
  path,
  user,
}: {
  path: string;
  user: User;
}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `API request failed (${response.status}): ${response.statusText} ${text}`
    );
  }

  return (await response.json()) as T;
}

export async function fetchProjects(user: User): Promise<GetNotebookListResponse> {
  return apiFetch<GetNotebookListResponse>({
    path: '/api/notebooks',
    user,
  });
}

export async function fetchProjectDetails({
  projectId,
  user,
}: {
  projectId: string;
  user: User;
}): Promise<GetNotebookResponse> {
  return apiFetch<GetNotebookResponse>({
    path: `/api/notebooks/${projectId}`,
    user,
  });
}

