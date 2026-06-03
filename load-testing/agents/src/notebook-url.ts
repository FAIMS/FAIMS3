import type {AgentEnv} from './config.js';

export function getNotebookUrl(env: AgentEnv): string {
  const base = env.DASS_APP_URL.replace(/\/$/, '');
  return `${base}/${env.NOTEBOOK_NAME}s/${env.NOTEBOOK_SERVER_ID}/${env.NOTEBOOK_PROJECT_ID}`;
}
