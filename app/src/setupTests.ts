// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: setupTests.ts
 * Description:
 *   TODO
 */

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
//import '@testing-library/jest-dom';
//jest.setTimeout(15000); // in milliseconds

import PouchDB from 'pouchdb-browser';
import PouchDBAdaptorMemory from 'pouchdb-adapter-memory';
import {ProjectID} from '@faims3/data-model';
import {vi} from 'vitest';
PouchDB.plugin(PouchDBAdaptorMemory);

const projdbs: any = {};

async function mockProjectDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

vi.mock('./sync/index', () => ({
  getProjectDB: mockProjectDB,
}));

async function mockGetTokenForCluster(listing_id: string) {
  return 'token-' + listing_id;
}

vi.mock('./users', () => ({
  getTokenForCluster: mockGetTokenForCluster,
  shouldDisplayRecord: () => true,
}));
