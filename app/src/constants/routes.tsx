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

import {
  AvpUpdateMode,
  ProjectID,
  RecordID,
  RevisionID,
} from '@faims3/data-model';
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
export const RECORD_VIEW = '/view-record/';
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
export const POUCH_EXPLORER = '/pouchDB';

export function getNotebookRoute({
  serverId,
  projectId,
}: {
  serverId: string;
  projectId: string;
}) {
  return INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + projectId;
}

/**
 * Generates a route to a record in the format
 *
 * @returns /surveys/<server>/<project>/records/<recordId>/revision/<revisionId>
 */
export function getEditRecordRoute({
  serverId,
  projectId,
  recordId,
  mode,
}: {
  serverId: string;
  projectId: ProjectID;
  recordId: RecordID;
  mode?: AvpUpdateMode;
}) {
  if (!!serverId && !!projectId && !!recordId) {
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
      projectId +
      RECORD_EXISTING +
      recordId +
      (mode ? `?mode=${mode}` : '')
    );
  }
  console.error('Trying to create record route with missing details!');
  console.error({serverId, projectId, recordId});
  throw Error(
    'project_id, record_id and revision_id are required for this route'
  );
}

/**
 * Generates a route to a record in the format
 *
 * @returns /surveys/<server>/<project>/view-record/<recordId>?revisionId=<revisionId>
 */
export function getViewRecordRoute({
  serverId,
  projectId,
  recordId,
  revisionId,
}: {
  serverId: string;
  projectId: ProjectID;
  recordId: RecordID;
  revisionId?: RecordID;
}) {
  return (
    INDIVIDUAL_NOTEBOOK_ROUTE +
    serverId +
    '/' +
    projectId +
    RECORD_VIEW +
    recordId +
    (revisionId ? `?revisionId=${revisionId}` : '')
  );
}

/**
 * Generates a route for a new draft
 * @param serverId the server
 * @param projectId the project
 * @param draftId the ID of the draft - this is pre-seeded
 * @param existingRecordInformation existing record? If provided instead returns the existing record route
 * @param formId the ID of the form
 * @param recordId the ID of the record
 * @returns The route to navigate to
 */
export function getNewDraftRoute(
  serverId: string,
  projectId: ProjectID,
  draftId: string,
  existingRecordInformation: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  },
  formId: string,
  recordId: string
) {
  if (existingRecordInformation !== null)
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
      projectId +
      RECORD_EXISTING +
      // existing+
      existingRecordInformation.record_id +
      REVISION +
      existingRecordInformation.revision_id +
      RECORD_DRAFT +
      draftId
    );
  else {
    return (
      INDIVIDUAL_NOTEBOOK_ROUTE +
      serverId +
      '/' +
      projectId +
      RECORD_CREATE +
      formId +
      RECORD_DRAFT +
      draftId +
      RECORD_RECORD +
      recordId
    );
  }
}
