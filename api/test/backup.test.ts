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
 * Filename: couchdb.tests.ts
 * Description:
 *   Tests for the interface to couchDB
 */
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {
  getRecordsWithRegex,
  notebookRecordIterator,
  registerClient,
} from '@faims3/data-model';
import {expect} from 'chai';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {
  getUserProjectsDetailed,
  getProjectUIModel,
} from '../src/couchdb/notebooks';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {mockTokenContentsForUser} from '../src/utils';
import {
  callbackObject,
  cleanDataDBS,
  mockGetDataDB,
  resetDatabases,
} from './mocks';
import {initialiseDbAndKeys} from '../src/couchdb';

// register our mock database clients with the module
registerClient(callbackObject);

describe('Backup and restore', () => {
  it('restore backup', async () => {
    await resetDatabases();
    await cleanDataDBS();
    await initialiseDbAndKeys({});

    await restoreFromBackup({filename: 'test/backup.jsonl'});

    // should now have the notebooks from the backup defined
    const user = await getExpressUserFromEmailOrUserId('admin');
    expect(user).not.to.be.undefined;
    if (user) {
      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).to.equal(2);
      expect(notebooks[0].name).to.equal('Campus Survey Demo');

      // test record iterator while we're here
      const projectId = notebooks[0].project_id;
      const uiSpec = await getProjectUIModel(projectId);
      const dataDb = await mockGetDataDB(projectId);

      const iterator = await notebookRecordIterator({
        dataDb,
        projectId,
        uiSpecification: uiSpec,
        viewID: 'FORM2',
      });
      let count = 0;
      let {record, done} = await iterator.next();
      while (record && !done) {
        count += 1;
        ({record, done} = await iterator.next());
      }
      expect(count).to.equal(17);

      // throw in a test of getRecordsWithRegex while we're here
      const tokenContents = mockTokenContentsForUser(user);
      const records = await getRecordsWithRegex({
        dataDb,
        regex: '.*',
        tokenContents,
        projectId,
        filterDeleted: true,
        uiSpecification: uiSpec,
      });
      expect(records).to.have.lengthOf(28);
    }
  });
});
