/* eslint-disable node/no-unpublished-import */
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
 * Filename: projectMetadata.test.js
 * Description:
 *   TODO
 */

import {test, fc} from '@fast-check/vitest';
import {describe, vi, expect} from 'vitest';
import PouchDB from 'pouchdb-browser';
import {getProjectMetadata, setProjectMetadata} from './projectMetadata';
import {ProjectID} from 'faims3-datamodel';
import {equals} from './utils/eqTestSupport';

const projdbs: any = {};

async function mockProjectDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

// async function cleanProjectDBS() {
//   let db;
//   for (const project_id in projdbs) {
//     db = projdbs[project_id];
//     delete projdbs[project_id];

//     if (db !== undefined) {
//       try {
//         await db.destroy();
//         //await db.close();
//       } catch (err) {
//         console.error(err);
//       }
//     }
//   }
// }

vi.mock('./sync/index', () => ({
  getProjectDB: mockProjectDB,
}));

describe('roundtrip reading and writing to db', () => {
  const project_id = 'test_project_id';
  test.prop([
    fc.fullUnicodeString({minLength: 1}), // metadata_key
    fc.unicodeJsonValue(), //  unicodeJsonObject(), // metadata
  ])('metadata roundtrip', (metadata_key: string, metadata: any) => {
    // try {
    //   await cleanProjectDBS();
    // } catch (err) {
    //   console.error(err);
    //   fail('Failed to clean dbs');
    // }
    fc.pre(projdbs.length !== 0);

    return setProjectMetadata(project_id, metadata_key, metadata)
      .then(_result => {
        return getProjectMetadata(project_id, metadata_key);
      })
      .then(result => {
        expect(equals(result, metadata)).toBe(true);
      });
  });
});
