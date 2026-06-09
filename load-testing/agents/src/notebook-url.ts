import type {AgentEnv} from './config.js';

/** Build the notebook list URL for the configured project and server. */
export function getNotebookUrl(env: AgentEnv): string {
  const base = env.FAIMS_APP_URL.replace(/\/$/, '');
  return `${base}/${env.NOTEBOOK_NAME}s/${env.NOTEBOOK_SERVER_ID}/${env.NOTEBOOK_PROJECT_ID}`;
}
