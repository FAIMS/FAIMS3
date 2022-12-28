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
 * Filename: internals.test.ts
 * Description:
 *   tests for the internals module
 *
 */

import PouchDB from 'pouchdb';

import {ProjectID, HRID_STRING} from '../datamodel/core';
import {Record} from '../datamodel/ui';
import {generateFAIMSDataID, upsertFAIMSData} from './index';

import {getHRID, getRevision} from './internals';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

async function mockDataDB(project_id: ProjectID) {
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

jest.mock('../sync/index', () => ({
  getDataDB: mockDataDB,
}));

beforeEach(async () => {
  return await cleanDataDBS();
});

afterAll(async () => {
  return await cleanDataDBS();
});

describe('test internals', () => {
  test('test getHRID', async () => {
    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const userid = 'user';

    const record_id = generateFAIMSDataID();

    // record with an hrid field - one starting with HRID_STRING
    const doc: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: userid,
      updated_by: userid,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const hridField = HRID_STRING + 'FieldName';
    const hridValue = 'test HRID value';
    doc.data[hridField] = hridValue;
    doc.annotations[hridField] = 'annotation for HRID';

    return upsertFAIMSData(project_id, doc).then(revisionId => {
      return getRevision(project_id, revisionId)
        .then(revision => {
          return getHRID(project_id, revision);
        })
        .then(hrid => {
          expect(hrid).toBe(hridValue);
        });
    });
  });
});
