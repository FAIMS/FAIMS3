import type {SharedEnv} from '@faims3/load-testing-shared';

export function getNotebookUrl(env: SharedEnv): string {
  const base = env.DASS_APP_URL.replace(/\/$/, '');
  return `${base}/notebooks/${env.NOTEBOOK_SERVER_ID}/${env.NOTEBOOK_PROJECT_ID}`;
}
