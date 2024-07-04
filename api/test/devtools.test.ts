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
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

import {initialiseDatabases} from '../src/couchdb';
import {createNotebook} from '../src/couchdb/notebooks';
import * as fs from 'fs';
import {createRandomRecord} from '../src/couchdb/devtools';
import {registerClient} from 'faims3-datamodel';
import {DEVELOPER_MODE} from '../src/buildconfig';
import {expect} from 'chai';
import {callbackObject} from './mocks';

// set up the database module faims3-datamodel with our callbacks to get databases
registerClient(callbackObject);

if (DEVELOPER_MODE) {
  it('createRecords', async () => {
    await initialiseDatabases();

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const projectID = await createNotebook('Test Notebook', uiSpec, metadata);

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
