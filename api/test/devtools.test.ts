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
 * Filename: devtools.tests.ts
 * Description:
 *   Tests for the devtools module
 */
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {registerClient} from '@faims3/data-model';
import {expect} from 'chai';
import {DEVELOPER_MODE} from '../src/buildconfig';
import {initialiseDbAndKeys} from '../src/couchdb';
import {createRandomRecord} from '../src/couchdb/devtools';
import {callbackObject} from './mocks';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient(callbackObject);

if (DEVELOPER_MODE) {
  it('createRecords', async () => {
    await initialiseDbAndKeys({});

    const {createNotebookFromSampleFile} = await import('./sampleNotebook');
    const projectID = await createNotebookFromSampleFile('Test Notebook');

    expect(projectID).not.to.be.undefined;

    if (projectID) {
      await createRandomRecord(projectID);
    }
  });
} else {
  it('dummy test since we must have at least one test', async () => {
    expect(true).to.be.true;
  });
}
