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

import {AvpUpdateMode, RecordID} from '@faims3/data-model';
import {config} from '../buildconfig';

export const INDEX = '/';
export const SIGN_IN = '/signin/';
export const AUTH_RETURN = '/auth-return/';
export const NOT_FOUND = '/not-found';
export const INDIVIDUAL_NOTEBOOK_ROUTE = `/${config.notebookNamePlural}/`;
export const NOTEBOOK_LIST_ROUTE = '/';
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
 * The tab a view shows for the slug the route names: the one it matches, or its
 * default. FAIMS3 keeps no list of tabs, so an unknown slug is not an error.
 */
export const resolveTab = <T extends string>(
  tabs: readonly [T, ...T[]],
  tab?: string
): T => {
  const match = tabs.find(t => t === tab);
  // Links written outside a view name a slug it may not carry, so falling back
  // to the default tab is a link to fix rather than something the user did
  if (tab !== undefined && match === undefined)
    console.warn(`no '${tab}' tab in this view, showing '${tabs[0]}'`);
  return match ?? tabs[0];
};

/**
 * The notebook route is keyed by the tab it shows, with the record routes nested
 * under it so leaving a record with `..` lands back on that tab. The segment is
 * optional, so a link written without a tab still resolves.
 */
export const NOTEBOOK_ROUTE_PATH = `${INDIVIDUAL_NOTEBOOK_ROUTE}:serverId/:projectId/:tab?`;
export const EDIT_RECORD_ROUTE_PATH = `${EDIT_RECORD_SEGMENT}/:recordId`;
export const VIEW_RECORD_ROUTE_PATH = `${VIEW_RECORD_SEGMENT}/:recordId`;

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
  return (
    INDIVIDUAL_NOTEBOOK_ROUTE +
    serverId +
    '/' +
    projectId +
    (tab ? '/' + tab : '')
  );
}

/**
 * The route a record link is rendered from. The record routes nest under the
 * notebook route, which is the segment carrying the tab, so a link from a
 * record page has one more segment to climb than one from the notebook page.
 */
type RecordLinkOrigin = 'notebook' | 'record';

const RECORD_LINK_PREFIX: Record<RecordLinkOrigin, string> = {
  notebook: '',
  record: '../',
};

/**
 * Generates a route to the edit page for a record, relative to the route it is
 * rendered from.
 *
 * @returns [../]records/<recordId>
 */
export function getEditRecordRoute({
  from,
  recordId,
  mode,
}: {
  from: RecordLinkOrigin;
  recordId: RecordID;
  mode?: AvpUpdateMode;
}) {
  return (
    `${RECORD_LINK_PREFIX[from]}${EDIT_RECORD_SEGMENT}/${recordId}` +
    (mode ? `?mode=${mode}` : '')
  );
}

/**
 * Generates a route to the read-only view page for a record, relative to the
 * route it is rendered from.
 *
 * @returns [../]view-record/<recordId>
 */
export function getViewRecordRoute({
  from,
  recordId,
  revisionId,
}: {
  from: RecordLinkOrigin;
  recordId: RecordID;
  revisionId?: RecordID;
}) {
  return (
    `${RECORD_LINK_PREFIX[from]}${VIEW_RECORD_SEGMENT}/${recordId}` +
    (revisionId ? `?revisionId=${revisionId}` : '')
  );
}
