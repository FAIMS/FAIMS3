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
import {useEffect} from 'react';
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

/** Tab slugs more than one view carries; a view without one shows its default. */
export const SHARED_TAB = {
  map: 'map',
  details: 'details',
  settings: 'settings',
} as const;

/**
 * The tab matching the route's slug, or the view's default. A slug the view
 * does not carry redirects to the default, so the URL names the tab on screen
 * and the record links built under it resolve.
 */
export const useResolveTab = <T extends string>(
  tabs: readonly [T, ...T[]],
  tab: string | undefined,
  setTab: (tab: string) => void
): T => {
  const match = tabs.find(t => t === tab);
  useEffect(() => {
    if (tab !== undefined && match === undefined) setTab(tabs[0]);
  }, [tab, match, setTab, tabs]);
  return match ?? tabs[0];
};

/** Keyed by the tab shown; optional, so tab-less links still resolve. */
export const NOTEBOOK_ROUTE_PATH = `${INDIVIDUAL_NOTEBOOK_ROUTE}:serverId/:projectId/:tab?`;
export const EDIT_RECORD_ROUTE_PATH = `${EDIT_RECORD_SEGMENT}/:recordId`;
export const VIEW_RECORD_ROUTE_PATH = `${VIEW_RECORD_SEGMENT}/:recordId`;

/**
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

/** One up from a record route: the notebook, on the tab it was opened from. */
export const NOTEBOOK_FROM_RECORD_ROUTE = '..';

/** The notebook a record link nests under: ids from the project, tab from the route. */
export type RecordRouteNotebook = {
  serverId: string;
  projectId: string;
  tab?: string;
};

/**
 * @returns /<notebook-plural>/<server>/<project>[/<tab>]/records/<recordId>
 */
export function getEditRecordRoute({
  recordId,
  mode,
  ...notebook
}: RecordRouteNotebook & {
  recordId: RecordID;
  mode?: AvpUpdateMode;
}) {
  return (
    `${getNotebookRoute(notebook)}/${EDIT_RECORD_SEGMENT}/${recordId}` +
    (mode ? `?mode=${mode}` : '')
  );
}

/**
 * @returns /<notebook-plural>/<server>/<project>[/<tab>]/view-record/<recordId>
 */
export function getViewRecordRoute({
  recordId,
  revisionId,
  ...notebook
}: RecordRouteNotebook & {
  recordId: RecordID;
  revisionId?: RecordID;
}) {
  return (
    `${getNotebookRoute(notebook)}/${VIEW_RECORD_SEGMENT}/${recordId}` +
    (revisionId ? `?revisionId=${revisionId}` : '')
  );
}
