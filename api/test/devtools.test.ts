// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: devtools.tests.ts
 * Description:
 *   Tests for the devtools module
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {registerClient} from '@faims3/data-model';
import {expect, it} from 'vitest';
import {config} from '../src/buildconfig';
import {initialiseDbAndKeys} from '../src/couchdb';
import {createRandomRecord} from '../src/couchdb/devtools';
import {callbackObject} from './mocks';
import {createNotebookFromSampleFile} from './sampleNotebook';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient(callbackObject);

if (config.developerMode) {
  it('createRecords', async () => {
    await initialiseDbAndKeys({});

    const projectID = await createNotebookFromSampleFile('Test Notebook');

    expect(projectID).not.toBeUndefined();

    if (projectID) {
      await createRandomRecord(projectID);
    }
  });
} else {
  it('dummy test since we must have at least one test', async () => {
    expect(true).toBe(true);
  });
}
