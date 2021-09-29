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

import {ProjectID, RecordID, RevisionID} from '../datamodel/core';

export const INDEX = '/';
export const SIGN_UP = '/signup';
export const SIGN_IN = '/signin';
export const FORGOT_PASSWORD = '/forgot-password';
export const NOT_FOUND = '/not-found';
export const HOME = '/home';
export const PROJECT_LIST = '/projects';
export const PROJECT = '/projects/';
export const PROJECT_SETTINGS = '/settings';
export const RECORD_LIST = '/records';
export const RECORD_EXISTING = '/records/';
export const RECORD_CREATE = '/new/';
export const RECORD_DRAFT = '/draft/';
export const REVISION = '/revision/';
export const ABOUT_BUILD = '/about-build';
export const AUTOINCREMENT_LIST = '/autoincrements';
export const AUTOINCREMENT = '/autoincrements/';
export const PROJECT_CREATE = '/new-notebook';
export const PROJECT_DESIGN = '/notebook/';

export function getRecordRoute(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
) {
  if (!!project_id && !!record_id && !!revision_id) {
    return (
      PROJECT +
      project_id +
      RECORD_EXISTING +
      record_id +
      REVISION +
      revision_id
    );
  }
  throw Error(
    'project_id, record_id and revision_id are required for this route'
  );
}
