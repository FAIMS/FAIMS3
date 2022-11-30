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
import PouchDB from 'pouchdb';
import {jsonStringifyStream} from '@worker-tools/json-stream';

import {draft_db} from './draft-storage';
import {
  directory_db,
  active_db,
  local_auth_db,
  local_state_db,
  projects_dbs,
  metadata_dbs,
  data_dbs,
} from './databases';
import {downloadBlob, shareCallbackAsFileOnApp} from '../utils/downloadShare';

interface DumpObject {
  [name: string]: unknown;
}

async function dumpDatabase(db: PouchDB.Database<any>): Promise<unknown> {
  return await db.allDocs({
    attachments: true, // We want base64 strings so we can get JSON
    conflicts: true, // We want to see conflict information
    include_docs: true, // We want the actual data
    update_seq: true,
    // This may help with debugging and with tracking multiple dumps
  });
}

export async function getFullDBSystemDump(): Promise<string> {
  const dump: DumpObject = {};
  dump['directory'] = await dumpDatabase(directory_db.local);
  dump['active'] = await dumpDatabase(active_db);
  dump['local_state'] = await dumpDatabase(local_state_db);
  dump['local_auth'] = await dumpDatabase(local_auth_db);
  dump['draft'] = await dumpDatabase(draft_db);

  for (const [name, db] of Object.entries(projects_dbs)) {
    dump['proj' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(metadata_dbs)) {
    dump['meta' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(data_dbs)) {
    dump['data' + name] = await dumpDatabase(db.local);
  }

  return JSON.stringify(dump);
}

export async function getFullDBSystemDumpAsBlob(): Promise<Blob> {
  const dump: DumpObject = {};
  dump['directory'] = await dumpDatabase(directory_db.local);
  dump['active'] = await dumpDatabase(active_db);
  dump['local_state'] = await dumpDatabase(local_state_db);
  dump['local_auth'] = await dumpDatabase(local_auth_db);
  dump['draft'] = await dumpDatabase(draft_db);

  for (const [name, db] of Object.entries(projects_dbs)) {
    dump['proj' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(metadata_dbs)) {
    dump['meta' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(data_dbs)) {
    dump['data' + name] = await dumpDatabase(db.local);
  }
  const stream = jsonStringifyStream(dump);
  const chunks: any[] = [];
  const reader = stream.pipeThrough(new TextEncoderStream()).getReader();
  while (true) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }
  return new Blob(chunks, {
    type: 'application/json',
  });
}

export async function doDumpShare() {
  console.error('Starting app system dump');
  const dump: DumpObject = {};
  dump['directory'] = await dumpDatabase(directory_db.local);
  dump['active'] = await dumpDatabase(active_db);
  dump['local_state'] = await dumpDatabase(local_state_db);
  dump['local_auth'] = await dumpDatabase(local_auth_db);
  dump['draft'] = await dumpDatabase(draft_db);

  for (const [name, db] of Object.entries(projects_dbs)) {
    dump['proj' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(metadata_dbs)) {
    dump['meta' + name] = await dumpDatabase(db.local);
  }

  for (const [name, db] of Object.entries(data_dbs)) {
    dump['data' + name] = await dumpDatabase(db.local);
  }
  const stream = jsonStringifyStream(dump);
  const reader = stream.pipeThrough(new TextEncoderStream()).getReader();

  const callback = async (func: any) => {
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      await func(value);
    }
  };

  await shareCallbackAsFileOnApp(
    callback,
    'FAIMS Database Dump',
    'Share all the FAIMS data on your device',
    'faims3-dump.json'
  );
}

export async function doDumpDownload() {
  console.error('Starting browser system dump');
  const b = await getFullDBSystemDumpAsBlob();
  console.error('Finished browser system dump, starting download');
  downloadBlob(b, 'faims3-dump.json');
}
