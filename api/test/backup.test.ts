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
import {getNotebooks, getProjectUIModel} from '../src/couchdb/notebooks';
import {getUserFromEmailOrUsername} from '../src/couchdb/users';
import {generateTokenContentsForUser} from '../src/utils';
import {callbackObject, cleanDataDBS, resetDatabases} from './mocks';
import {initialiseDatabases} from '../src/couchdb';

// register our mock database clients with the module
registerClient(callbackObject);

describe('Backup and restore', () => {
  it('restore backup', async () => {
    await resetDatabases();
    await cleanDataDBS();
    await initialiseDatabases({});

    await restoreFromBackup('test/backup.jsonl');

    // should now have the notebooks from the backup defined
    const user = await getUserFromEmailOrUsername('admin');
    expect(user).not.to.be.undefined;
    if (user) {
      const notebooks = await getNotebooks(user);
      expect(notebooks.length).to.equal(2);
      expect(notebooks[0].name).to.equal('Campus Survey Demo');

      // test record iterator while we're here
      const uiSpec = await getProjectUIModel(notebooks[0].project_id);
      const iterator = await notebookRecordIterator(
        notebooks[0].project_id,
        'FORM2',
        undefined,
        uiSpec
      );
      let count = 0;
      let {record, done} = await iterator.next();
      while (record && !done) {
        count += 1;
        ({record, done} = await iterator.next());
      }
      expect(count).to.equal(17);

      // throw in a test of getRecordsWithRegex while we're here
      const tokenContents = generateTokenContentsForUser(user);
      const records = await getRecordsWithRegex(
        tokenContents,
        notebooks[0].project_id,
        '.*',
        true,
        uiSpec
      );
      expect(records).to.have.lengthOf(28);
    }
  });
});
