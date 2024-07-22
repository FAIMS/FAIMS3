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
import PouchDB from 'pouchdb-browser';
import {jsonStringifyStream} from '@worker-tools/json-stream';
import {Filesystem, Directory, Encoding} from '@capacitor/filesystem';

import {draft_db} from './draft-storage';
import {
  directory_db,
  active_db,
  local_auth_db,
  getLocalStateDB,
  projects_dbs,
  metadata_dbs,
  data_dbs,
} from './databases';
import {Share} from '@capacitor/share';

const PREFIX = 'faims3-';

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

  keepDumping = await progressiveDump(directory_db.local, writer(0, 5));
  if (keepDumping)
    keepDumping = await progressiveDump(active_db, writer(5, 10));
  if (keepDumping)
    keepDumping = await progressiveDump(getLocalStateDB(), writer(10, 12));
  if (keepDumping)
    keepDumping = await progressiveDump(local_auth_db, writer(12, 15));
  if (keepDumping)
    keepDumping = await progressiveDump(draft_db, writer(15, 20));

  let start = 20;
  let end;
  let size = Object.keys(projects_dbs).length;
  for (const [, db] of Object.entries(projects_dbs)) {
    end = start + 10 / size;
    if (keepDumping)
      keepDumping = await progressiveDump(db.local, writer(start, end));
    start = end;
  }

  start = 30;
  size = Object.keys(metadata_dbs).length;
  for (const [, db] of Object.entries(metadata_dbs)) {
    end = start + 10 / size;
    if (keepDumping)
      keepDumping = await progressiveDump(db.local, writer(start, end));
    start = end;
  }

  start = 40;
  size = Object.keys(data_dbs).length;
  for (const [, db] of Object.entries(data_dbs)) {
    end = start + 60 / size;
    if (keepDumping)
      keepDumping = await progressiveDump(db.local, writer(start, end));
    start = end;
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

//*************** Streaming download of a database dump   ****************/

// TODO: change the format to match that of the progressive download above
//  also make this progressive and interruptible

/**
 * downloadBlob - download a blob as a file onto a user's device
 * @param b - blob to download
 * @param filename - filename for the downloaded file
 */
function downloadBlob(b: Blob, filename: string) {
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

async function streamedDumpDownload(filename: string, obj: any) {
  const stream = jsonStringifyStream(obj);
  const chunks: any[] = [];
  const reader = stream.pipeThrough(new TextEncoderStream()).getReader();
  while (true) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }
  const b = new Blob(chunks, {
    type: 'application/json',
  });
  downloadBlob(b, PREFIX + filename + '.json');
}

async function dumpDatabase(db: PouchDB.Database<any>) {
  return db.allDocs({
    attachments: true, // We want base64 strings so we can get JSON
    conflicts: true, // We want to see conflict information
    include_docs: true, // We want the actual data
    update_seq: true,
  });
}

export async function doDumpDownload() {
  console.debug('Starting browser system dump');

  await streamedDumpDownload(
    'directory',
    await dumpDatabase(directory_db.local)
  );
  await streamedDumpDownload('active', await dumpDatabase(active_db));
  await streamedDumpDownload(
    'local_state',
    await dumpDatabase(getLocalStateDB())
  );
  await streamedDumpDownload('local_auth', await dumpDatabase(local_auth_db));
  await streamedDumpDownload('draft', await dumpDatabase(draft_db));

  for (const [name, db] of Object.entries(projects_dbs)) {
    await streamedDumpDownload('proj' + name, await dumpDatabase(db.local));
  }

  for (const [name, db] of Object.entries(metadata_dbs)) {
    await streamedDumpDownload('meta' + name, await dumpDatabase(db.local));
  }

  for (const [name, db] of Object.entries(data_dbs)) {
    await streamedDumpDownload('data' + name, await dumpDatabase(db.local));
  }
}
