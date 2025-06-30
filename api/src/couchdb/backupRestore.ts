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
import {batchWriteDocuments} from '@faims3/data-model';
import {open} from 'node:fs/promises';
import {initialiseDataDb, initialiseMetadataDb, localGetProjectsDb} from '.';

/**
 * restoreFromBackup - restore databases from a JSONL backup file
 * Backup file contains one line per document from the database
 * Each database starts with a JSONL line with the key `type="header"`
 * @param filename - file containing JSONL backup of databases
 * @param pattern - optional regex pattern to filter databases to restore
 * @param force - if true, overwrite existing documents if present, default is false
 */
export const restoreFromBackup = async ({
  filename,
  pattern = '.*',
  force = false,
}: {
  filename: string;
  pattern?: string;
  force?: boolean;
}) => {
  const file = await open(filename);

  let dbName: string;
  let db: any;
  let line_number = 1;
  let processedCount = 0;
  const GC_INTERVAL = 1000; // Force GC every 1000 records
  const BATCH_SIZE = 500; // Smaller batches
  let batch: any[] = [];
  let skipping = false;

  try {
    for await (const line of file.readLines()) {
      if (processedCount % GC_INTERVAL === 0 && processedCount > 0) {
        // Process batch before GC
        if (batch.length > 0 && db) {
          await batchWriteDocuments({
            db,
            documents: batch,
            writeOnClash: true,
          });
          // console.log(
          //   `Batch results: ${results.successful} successful, ${results.failed} failed`
          // );
          batch = []; // Clear batch
        }

        if (global.gc) {
          global.gc();
        }

        // const memUsage = process.memoryUsage();
        // console.log(
        //   `Processed ${processedCount} records. Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        // );
      }

      try {
        let doc = JSON.parse(line);
        if (doc.type === 'header') {
          // write out any remaining documents to the previous db
          if (batch.length > 0 && db) {
            await batchWriteDocuments({
              db,
              documents: batch,
              writeOnClash: force,
            });
            // console.log(
            //   `Batch results: ${results.successful} successful, ${results.failed} failed`
            // );
            batch = [];
          }
          // update the database
          dbName = doc.database;
          skipping = dbName.match(pattern) === null;
          if (skipping) {
            console.log(`Skipping database ${dbName}`);
          } else {
            console.log(`Processing database ${dbName}`);
          }
          if (dbName.startsWith('projects')) {
            // name will be eg. 'projects_default', where 'default' is the
            // conductor instance id
            // we'll put all projects into our projectsDB
            db = localGetProjectsDb();
          } else if (!skipping && dbName.startsWith('metadata')) {
            const projectName = dbName.split('||')[1];
            // TODO: set up permissions for the databases
            db = await initialiseMetadataDb({
              projectId: projectName,
              force: true,
            });
          } else if (!skipping && dbName.startsWith('data')) {
            const projectName = dbName.split('||')[1];
            // TODO: set up permissions for the databases
            db = await initialiseDataDb({
              projectId: projectName,
              force: true,
            });
          } else {
            // don't try to restore anything we don't know about
            db = undefined;
          }
        } else if (!skipping && !doc.id.startsWith('_design') && db) {
          // don't try to restore design documents as these will have been
          // created on the database initialisation
          // Minimal document copy
          const docToWrite = {
            _id: doc.doc._id,
            ...doc.doc,
          };
          // delete the _rev attribute so that we can put it into an empty db
          // if we were restoring into an existing db, we would need to be more
          // careful and check whether this _rev is present in the db already
          delete docToWrite._rev;

          batch.push(docToWrite);

          if (batch.length >= BATCH_SIZE) {
            await batchWriteDocuments({
              db,
              documents: batch,
              writeOnClash: force,
            });
            // console.log(
            //   `Batch results: ${results.successful} successful, ${results.failed} failed`
            // );
            batch = [];
          }
        }
        processedCount += 1;
        // Explicitly null out references to help GC
        doc = null;
      } catch (e: any) {
        console.error(
          `error parsing JSON on line ${line_number} ${JSON.stringify(e, undefined, 2)} ${e.stack}`
        );
        return;
      }
      line_number += 1;
    }
    // Process final batch
    if (batch.length > 0 && db) {
      await batchWriteDocuments({db, documents: batch, writeOnClash: force});
      batch = [];
    }
  } finally {
    await file.close();
  }
  console.log(`Restore completed. Total records processed: ${processedCount}`);
};
