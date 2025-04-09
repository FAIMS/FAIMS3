import {capitalize} from './lib/utils';

export const NOTEBOOK_NAME = import.meta.env.VITE_NOTEBOOK_NAME || 'project';

export const WEB_URL =
  (import.meta.env.VITE_WEB_URL as string | undefined) ?? '';
if (WEB_URL === '') {
  throw new Error('Missing required env variable VITE_WEB_URL');
}

export const NOTEBOOK_NAME_CAPITALIZED = import.meta.env.VITE_NOTEBOOK_NAME
  ? capitalize(import.meta.env.VITE_NOTEBOOK_NAME)
  : 'Project';
