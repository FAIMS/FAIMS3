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

import {AvpUpdateMode, ProjectID, RecordID} from '@faims3/data-model';
import {config} from '../buildconfig';

export const INDEX = '/';
export const SIGN_IN = '/signin/';
export const AUTH_RETURN = '/auth-return/';
export const NOT_FOUND = '/not-found';
export const INDIVIDUAL_NOTEBOOK_ROUTE = `/${config.notebookNamePlural}/`;
export const NOTEBOOK_LIST_ROUTE = '/';
export const RECORD_CREATE = '/new/';
export const RECORD_RECORD = '/record/';
export const REVISION = '/revision/';
export const ABOUT_BUILD = '/about-build';
export const OFFLINE_MAPS = '/offline-maps';
export const AUTOINCREMENT = '/autoincrements/';
export const PROJECT_ATTACHMENT = '/attachment/';
export const SWITCH_ORG = '/switch-organisation';
export const HELP = '/help';
export const USER_ACTIVE_TESTR = '/test';
export const POUCH_EXPLORER = '/pouchDB';

const EDIT_RECORD_SEGMENT = 'records';
const VIEW_RECORD_SEGMENT = 'view-record';

/**
 * The notebook route is keyed by the tab it is showing, with the record routes
 * nested under it so leaving a record with `..` lands back on that tab. The
 * segment is optional so links written without a tab still resolve.
 */
export const NOTEBOOK_ROUTE_PATH = `${INDIVIDUAL_NOTEBOOK_ROUTE}:serverId/:projectId/:tab?`;
export const EDIT_RECORD_ROUTE_PATH = `${EDIT_RECORD_SEGMENT}/:recordId`;
export const VIEW_RECORD_ROUTE_PATH = `${VIEW_RECORD_SEGMENT}/:recordId`;

/** The notebook route prefix a record route hangs off, tab segment included. */
function notebookRoutePrefix({
  serverId,
  projectId,
  tab,
}: {
  serverId: string;
  projectId: string;
  tab?: string;
}) {
  return (
    INDIVIDUAL_NOTEBOOK_ROUTE +
    serverId +
    '/' +
    projectId +
    (tab ? '/' + tab : '')
  );
}

/**
 * Generates a route to a notebook, on the given tab where one is named.
 *
 * @returns /<notebook-plural>/<server>/<project>[/<tab>]
 */
export function getNotebookRoute({
  serverId,
  projectId,
  tab,
}: {
  serverId: string;
  projectId: string;
  tab?: string;
}) {
  return notebookRoutePrefix({serverId, projectId, tab});
}

/**
 * Generates a route to the edit page for a record.
 *
 * @returns /<notebook-plural>/<server>/<project>[/<tab>]/records/<recordId>
 */
export function getEditRecordRoute({
  serverId,
  projectId,
  recordId,
  tab,
  mode,
}: {
  serverId: string;
  projectId: ProjectID;
  recordId: RecordID;
  tab?: string;
  mode?: AvpUpdateMode;
}) {
  if (!!serverId && !!projectId && !!recordId) {
    return (
      notebookRoutePrefix({serverId, projectId, tab}) +
      '/' +
      `${EDIT_RECORD_SEGMENT}/${recordId}` +
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
 * Generates a route to the read-only view page for a record.
 *
 * @returns /<notebook-plural>/<server>/<project>[/<tab>]/view-record/<recordId>
 */
export function getViewRecordRoute({
  serverId,
  projectId,
  recordId,
  tab,
  revisionId,
}: {
  serverId: string;
  projectId: ProjectID;
  recordId: RecordID;
  tab?: string;
  revisionId?: RecordID;
}) {
  return (
    notebookRoutePrefix({serverId, projectId, tab}) +
    '/' +
    `${VIEW_RECORD_SEGMENT}/${recordId}` +
    (revisionId ? `?revisionId=${revisionId}` : '')
  );
}
