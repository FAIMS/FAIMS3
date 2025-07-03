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
 * Filename: src/sync/data-dump.ts
 * Description:
 *   Wrapper around local databases to preform a device-level dump.
 */
import {Directory, Encoding, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {databaseService} from '../context/slices/helpers/databaseService';
// eslint-disable-next-line n/no-extraneous-import
import PouchDB from 'pouchdb';

/**
 * progressiveDump - dump a database in chunks
 *  callback function is called with each chunk of data, if it
 * returns true then the dump continues, if it returns false
 * then the dump is aborted.
 *
 * @param db - database to be dumped
 * @param callback - callback function called to indicate progress
 * @returns true if dump was completed, false if it was aborted
 */
async function progressiveDump(
  db: PouchDB.Database<any>,
  callback: (rows: any[], progress: number) => Promise<boolean>
) {
  console.log('dumping database', db.name);

  const blockSize = 10;
  let count = 0;
  let total_rows = blockSize;
  const info = await db.info();

  // write an initial 'header' row with the database name
  const headerRow = {type: 'header', database: db.name, info: info};
  await callback([headerRow], 0);

  while (count < total_rows) {
    const newDocs = await db.allDocs({
      attachments: true, // We want base64 strings so we can get JSON
      conflicts: true, // We want to see conflict information
      include_docs: true, // We want the actual data
      update_seq: true,
      limit: blockSize,
      skip: count,
    });
    total_rows = newDocs.total_rows;
    count += newDocs.rows.length;
    //console.log('dump got ', count, ' docs out of ', newDocs.total_rows);
    if (newDocs.rows.length > 0) {
      if (!(await callback(newDocs.rows, (100 * count) / total_rows))) {
        return false;
      }
    }
  }
  return true;
}

async function permissionOK() {
  // check for permissions, not needed on newer Android but just
  // in case for older systems
  let permission = await Filesystem.checkPermissions();

  if (permission.publicStorage !== 'granted') {
    permission = await Filesystem.requestPermissions();
  }
  if (permission.publicStorage !== 'granted') {
    console.error('Permission to write files not granted', permission);
    return false;
  }
  return true;
}

async function appendToFile(path: string, rows: any[]) {
  //console.debug('Appending to file:', path);

  const directory = Directory.Documents;

  if (!(await permissionOK())) {
    return;
  }

  const data = rows.map(row => JSON.stringify(row)).join('\n') + '\n';

  //console.log('writing', data.length, 'characters');
  // crash when data length is > 35M so batch in chunks
  const chunkSize = 1000000;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await Filesystem.appendFile({
      path: path,
      data: chunk,
      directory: directory,
      encoding: Encoding.UTF8,
    });
  }
}

/**
 * progressiveSaveFiles - save all the databases to a file and share it
 * @param progressCallback - callback function takes a progress
 * value between 0 and 100 and returns true if we should carry on, false if we should abort
 * @returns true if the dump was completed, false if it was aborted
 */
export async function progressiveSaveFiles(
  progressCallback: (n: number) => boolean
) {
  if (!(await Share.canShare()).value) {
    progressCallback(-1); // signal inability to share back to caller
    return;
  }

  const isodate = new Date();
  const dateString = isodate.toISOString().slice(0, 10);
  const milliseconds = isodate.valueOf();
  const filename = `fieldmark-backup-${dateString}-${milliseconds}.jsonl`;
  let keepDumping = true;

  const writer = (start: number, end: number) => {
    // return a writer for the named database
    return async (rows: any[], progress: number): Promise<boolean> => {
      await appendToFile(filename, rows);
      return progressCallback(start + (progress * (end - start)) / 100);
    };
  };

  try {
    if (keepDumping)
      keepDumping = await progressiveDump(
        databaseService.getLocalStateDatabase(),
        writer(10, 12)
      );
  } catch {
    console.log('error dumping local state database');
  }

  try {
    if (keepDumping)
      keepDumping = await progressiveDump(
        databaseService.getDraftDatabase(),
        writer(15, 20)
      );
  } catch {
    console.log('error dumping draft database');
  }

  // TODO dump the redux store projects here
  /*
  let start = 20;
  let end;
  let size = Object.keys(projects_dbs).length;
  for (const [, db] of Object.entries(projects_dbs)) {
    end = start + 10 / size;
    if (keepDumping)
      keepDumping = await progressiveDump(db.local, writer(start, end));
    start = end;
  }
  */
  let start = 40;
  let end;

  // List out all of the data DBs
  //const state = store.getState();
  const dataDbs = await getDataDbsPrimitive(); // getAllDataDbs(state);

  console.log('dumping', dataDbs);

  const size = Object.keys(dataDbs).length;
  for (const db of dataDbs) {
    try {
      end = start + 60 / size;
      if (keepDumping)
        keepDumping = await progressiveDump(db, writer(start, end));
      start = end;
    } catch {
      console.log('error dumping database', db.name);
    }
  }

  // early exit if we were aborted
  if (!keepDumping) {
    // clean up - remove the file we made
    await Filesystem.deleteFile({
      directory: Directory.Documents,
      path: filename,
    });
    return;
  }

  const statResult = await Filesystem.stat({
    directory: Directory.Documents,
    path: filename,
  });

  // share the file we made

  try {
    await Share.share({
      title: filename,
      url: statResult.uri,
      dialogTitle: 'Share Fieldmark database dump',
    });
  } catch (err) {
    console.error('Share failed', err);
  }
  // signal end of processing
  progressCallback(110);
}

// Get all pouchDB data DBs by looking directly at the IDB
// databases on the device rather than using our active state
// this ensures that we can dump databases even if our own internal
// structures are broken
const getDataDbsPrimitive = async () => {
  const PREFIX = '_pouch_';
  const dbList = await indexedDB.databases();
  const dbs = dbList.filter(
    db => db.name && db.name.startsWith(PREFIX) && db.name.endsWith('_data')
  );
  return dbs.map(db => {
    const name =
      db.name ||
      'this will never happen because we filter out undefined names above, but typescript...';
    // get the pouchdb database name from the IDB name
    const dbName = name.replace(PREFIX, '');
    return new PouchDB<any>(dbName);
  });
};
