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
 * Filename: merging.test.ts
 * Description:
 *   TODO
 */

import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {ProjectID} from './datamodel/core';
import {Record} from './datamodel/ui';
import {
  deleteFAIMSDataForID,
  generateFAIMSDataID,
  getFirstRecordHead,
  getFullRecordData,
  listFAIMSProjectRevisions,
  undeleteFAIMSDataForID,
  upsertFAIMSData,
} from './data_storage';
import {equals} from './utils/eqTestSupport';

import {getDataDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

function mockDataDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

async function cleanDataDBS() {
  let db;
  for (const project_id in projdbs) {
    db = projdbs[project_id];
    delete projdbs[project_id];

    if (db !== undefined) {
      try {
        await db.destroy();
        //await db.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

jest.mock('./sync/index', () => ({
  getDataDB: mockDataDB,
}));


describe('test basic automerge', () => {
  test('single revision', async () => {
    // This tests the case where there is a single revision (i.e. new record)
  });
  test('no merged needed', async () => {
    // This tests the case where there is a linear history, so there's no need
    // for merging
  });
  test('extra head', async () => {
    // This tests the case where there is a linear history, but where an old
    // head was not removed (this shouldn't happen, but maybe there's some bad
    // integration code that wrote to couchdb
  });
  test('same change', async () => {
    // This tests the case where there has been a split, but the same change has
    // been made
  });
  test('different change', async () => {
    // This tests the case where there has been a split, and different changes
    // have been made. This should cause the basic automerge to fail.
  });
  test('changes to different avps', async () => {
    // This tests the case where there has been a split, but the changes have
    // been to different avps
  });
  test('changes to different avps AND different change', async () => {
    // This tests the case where there are three heads, of which two can be
    // merged
  });
  test('changes to different avps AND different change 4 HEADS', async () => {
    // This tests the case where there are 4 heads, of which three can be merged
    // together
  });
  test('changes to different avps AND different change 2 PAIRS', async () => {
    // This tests the case where there are 4 heads, but the merge this time is
    // as two pairs
  });
});
