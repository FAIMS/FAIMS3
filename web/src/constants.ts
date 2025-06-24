import {capitalize} from './lib/utils';


const getConfigValue = (key: string) => {
  const value = (import.meta.env[key] as string | undefined) ?? '';
  if (value === '') {
    throw new Error(`Missing required env variable ${key}`);
  }
  return value;
};

export const NOTEBOOK_NAME = import.meta.env.VITE_NOTEBOOK_NAME || 'project';
export const WEBSITE_TITLE =
  import.meta.env.VITE_WEBSITE_TITLE || 'Control Centre';
export const APP_NAME = getConfigValue('VITE_APP_NAME');
export const WEB_URL = getConfigValue('VITE_WEB_URL');
export const API_URL = getConfigValue('VITE_API_URL');
export const APP_URL = getConfigValue('VITE_APP_URL');
export const APP_THEME = import.meta.env.VITE_APP_THEME || 'default';

export const NOTEBOOK_NAME_CAPITALIZED = import.meta.env.VITE_NOTEBOOK_NAME
  ? capitalize(import.meta.env.VITE_NOTEBOOK_NAME)
  : 'Project';

export const DEVELOPER_MODE = import.meta.env.VITE_DEVELOPER_MODE === 'true';

export const SIGNIN_PATH = `${API_URL}/login?redirect=${WEB_URL}`;

// this is where the /app will accept a ?token query string
export const APP_TOKEN_RETURN_PATH = APP_URL + '/auth-return';

/**
 * Builds a suitable register URL which will redirect back to the targeted
 * location - requires an invite
 * @returns The full address to redirect the window to
 */
export function buildRegisterUrl({
  redirect,
  inviteId,
}: {
  redirect: string;
  inviteId: string;
}) {
  return `${API_URL}/register?redirect=${redirect}&inviteId=${inviteId}`;
}

// Token refresh interval (every 3 minutes)
export const REFRESH_INTERVAL = 3 * 60 * 1000;
