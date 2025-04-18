/*
 * Copyright 2021, 2022 Macquarie University
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

import {ProjectID, RecordID, RevisionID} from '@faims3/data-model';
import {NOTEBOOK_NAME} from '../buildconfig';

export const INDEX = '/';
export const SIGN_IN = '/signin/';
export const AUTH_RETURN = '/auth-return/';

export const NOT_FOUND = '/not-found';

export const INDIVIDUAL_NOTEBOOK_ROUTE = `/${NOTEBOOK_NAME}s/`;
export const INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q = 'tab';
export const NOTEBOOK_LIST_ROUTE = '/';

export const RECORD_LIST = '/records';
export const RECORD_EXISTING = '/records/';
export const RECORD_CREATE = '/new/';
export const RECORD_DRAFT = '/draft/';
export const RECORD_RECORD = '/record/';
export const REVISION = '/revision/';
export const ABOUT_BUILD = '/about-build';
export const OFFLINE_MAPS = '/offline-maps';
export const AUTOINCREMENT = '/autoincrements/';
export const PROJECT_ATTACHMENT = '/attachment/';
export const SWITCH_ORG = '/switch-organisation';
export const HELP = '/help';
export const CREATE_NEW_SURVEY = '/create-new-survey';
export const USER_ACTIVE_TESTR = '/test';

export function getRecordRoute(
  serverId: string,
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
) {
  if (!!serverId && !!project_id && !!record_id && !!revision_id) {
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
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

// this function is to get route for draft-- depend on edit draft or created draft??? TODO need to check created draft route
export function getDraftRoute(
  serverId: string,
  project_id: ProjectID,
  draft_id: string,
  existing: null | {record_id: RecordID; revision_id: RevisionID},
  type_name: string,
  record_id: string
) {
  if (existing !== null)
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
      project_id +
      RECORD_EXISTING +
      // existing+
      existing.record_id +
      REVISION +
      existing.revision_id +
      RECORD_DRAFT +
      draft_id
    );
  else {
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
      project_id +
      RECORD_CREATE +
      type_name +
      RECORD_DRAFT +
      draft_id +
      RECORD_RECORD +
      record_id
    );
  }
}
