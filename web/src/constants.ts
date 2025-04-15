import {capitalize} from './lib/utils';

export const NOTEBOOK_NAME = import.meta.env.VITE_NOTEBOOK_NAME || 'project';

export const WEB_URL =
  (import.meta.env.VITE_WEB_URL as string | undefined) ?? '';
if (WEB_URL === '') {
  throw new Error('Missing required env variable VITE_WEB_URL');
}

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';
if (API_URL === '') {
  throw new Error('Missing required env variable VITE_API_URL');
}

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? '';
if (APP_URL === '') {
  throw new Error('Missing required env variable VITE_APP_URL');
}

export const NOTEBOOK_NAME_CAPITALIZED = import.meta.env.VITE_NOTEBOOK_NAME
  ? capitalize(import.meta.env.VITE_NOTEBOOK_NAME)
  : 'Project';

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
