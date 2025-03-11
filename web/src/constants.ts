import {capitalize} from './lib/utils';

export const NOTEBOOK_NAME = import.meta.env.VITE_NOTEBOOK_NAME || 'project';
export const NOTEBOOK_NAME_CAPITALIZED =
  capitalize(import.meta.env.VITE_NOTEBOOK_NAME) || 'Project';
