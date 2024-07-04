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
 * Filename: backupRestore.ts
 * Description:
 *    Functions to backup and restore databases
 */
import {open} from 'node:fs/promises';
import {getProjectsDB} from '.';
import {
  addDesignDocsForNotebook,
  getDataDB,
  getProjectDB,
} from 'faims3-datamodel';

/**
 * restoreFromBackup - restore databases from a JSONL backup file
 * Backup file contains one line per document from the database
 * Each database starts with a JSONL line with the key `type="header"`
 * @param filename file containing JSONL backup of databases
 */
export const restoreFromBackup = async (filename: string) => {
  const file = await open(filename);

  let dbName;
  let db;

  for await (const line of file.readLines()) {
    const doc = JSON.parse(line);
    if (doc.type === 'header') {
      dbName = doc.database;

      if (dbName.startsWith('projects')) {
        // name will be eg. 'projects_default', where 'default' is the
        // conductor instance id
        // we'll put all projects into our projectsDB
        db = await getProjectsDB();
      } else if (dbName.startsWith('metadata')) {
        const projectName = dbName.split('||')[1];
        db = await getProjectDB(projectName);
      } else if (dbName.startsWith('data')) {
        const projectName = dbName.split('||')[1];
        db = await getDataDB(projectName);
        if (db) {
          addDesignDocsForNotebook(db);
          // TODO: set up permissions for the databases
        }
      } else {
        // don't try to restore anything we don't know about
        db = undefined;
      }
    } else if (!doc.id.startsWith('_design') && db) {
      // don't try to restore design documents as these will have been
      // created on the database initialisation

      // delete the _rev attribute so that we can put it into an empty db
      // if we were restoring into an existing db, we would need to be more
      // careful and check whether this _rev is present in the db already
      delete doc.doc._rev;
      try {
        await db.put(doc.doc);
      } catch (error) {
        console.log('Error restoring document', doc.id, error);
      }
    }
  }
};
