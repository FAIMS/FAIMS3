// SPDX-License-Identifier: Apache-2.0

/*
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
import {describe, expect, it} from 'vitest';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {
  getUserProjectsDetailed,
  getUiSpecModel,
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
    expect(user).not.toBeUndefined();
    if (user) {
      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).toBe(2);
      expect(notebooks[0].name).toBe('Campus Survey Demo');

      // test record iterator while we're here
      const projectId = notebooks[0]._id;
      const uiSpec = await getUiSpecModel(projectId);
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
      expect(count).toBe(17);

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
      expect(records).toHaveLength(28);
    }
  });
});
