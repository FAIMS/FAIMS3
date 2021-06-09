/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: routes.tsx
 * Description:
 *   TODO
 */

import {ProjectID} from '../datamodel';

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
export const ABOUT_BUILD = '/about-build';

export function getObservationRoute(
  project_id: ProjectID,
  observation_id: string
) {
  if (!!project_id && !!observation_id) {
    return PROJECT + project_id + OBSERVATION + observation_id;
  }
  throw Error('Both project_id and observation_id are required for this route');
}
