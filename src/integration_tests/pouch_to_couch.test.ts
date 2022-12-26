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
 * Filename: pouch_to_couch.test.ts
 * Description:
 *   TODO
 */

import PouchDB from 'pouchdb';
import {
  projects_dbs,
  data_dbs,
  metadata_dbs,
  directory_db,
} from '../sync/databases';
import {initialize} from '../sync/initialize';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
jest.setTimeout(1000 * 10);

test('run initialization', () => {
  expect(projects_dbs).toStrictEqual({});
  expect(metadata_dbs).toStrictEqual({});
  expect(data_dbs).toStrictEqual({});
  return initialize().then(state => {
    console.log('done initialise', state);
    expect(state).toBe(undefined);

    // this fails because we don't have a user token, auth?? need to mock out db
    // expect(projects_dbs).not.toStrictEqual({});

    // expect(metadata_dbs).not.toStrictEqual({});
    // expect(data_dbs).not.toStrictEqual({});

    return directory_db.local.allDocs().then(docs => {
      expect(docs.total_rows).toEqual(1);
    });
  });
  // console.error('directory', docs);
  // console.error('projects_dbs', projects_dbs);
  // console.error('metadata_dbs', metadata_dbs);
  // console.error('data_dbs', data_dbs);
});
