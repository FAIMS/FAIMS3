export const INDEX = '/';
export const SIGN_UP = '/signup';
export const SIGN_IN = '/signin';
export const FORGOT_PASSWORD = '/forgot-password';
export const NOT_FOUND = '/not-found';
export const HOME = '/home';
export const PROJECT_LIST = '/projects';
export const PROJECT = '/projects/';
export const OBSERVATION_LIST = '/observations';
export const OBSERVATION = '/observations/';
export const OBSERVATION_CREATE = '/new-observation';

export function getObservationRoute(
  project_id: string,
  observation_id: string
) {
  if (!!project_id && !!observation_id) {
    return PROJECT + project_id + OBSERVATION + observation_id;
  }
  throw Error('Both project_id and observation_id are required for this route');
}
