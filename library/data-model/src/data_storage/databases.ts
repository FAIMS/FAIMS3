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
 * Filename: databases.ts
 * Description:
 *   Functions for initialising databases
 */

type DesignDocument = {
  _id: string;
  _rev?: string;
  views?: {
    [key: string]: {
      map: string;
      reduce?: string;
    };
  };
  language?: string;
  validate_doc_update?: string;
};

const isEqualObjects = (a: any, b: any) => {
  // we have the same keys
  if (
    !Object.keys(a).every(key => key in b) ||
    !Object.keys(b).every(key => key in a)
  ) {
    return false;
  }
  // and all the key values match
  for (const key in a) {
    const a_value = a[key];
    const b_value = b[key];
    if (a_value instanceof Object && b_value instanceof Object) {
      if (!isEqualObjects(a_value, b_value)) {
        return false;
      }
    } else {
      if (a_value !== b_value) {
        console.log('objects differ on', key);
        return false;
      }
    }
  }
  return true;
};

export const addDesignDocsForNotebook = async (
  dataDB: PouchDB.Database<any>
) => {
  const documents: DesignDocument[] = [];
  documents.push({
    _id: '_design/attachment_filter',
    views: {
      attachment_filter: {
        map: `function (doc) {
            if (doc.attach_format_version === undefined) {
              emit(doc._id);
            }
          }`,
      },
    },
  });
  documents.push({
    _id: '_design/permissions',
    validate_doc_update: `function (newDoc, oldDoc, userCtx, _secObj) {
        if (userCtx === null || userCtx === undefined) {
          throw {unauthorized: 'You must be logged in. No token given.'};
        }
        if (userCtx.name === null || userCtx.name === undefined) {
          throw {unauthorized: 'You must be logged in. No username given.'};
        }
        return;
      }`,
  });

  // create indexes for each kind of document in the database
  documents.push({
    _id: '_design/index',
    views: {
      record: {
        map: 'function (doc) {\n  if (doc.record_format_version === 1)\n    emit(doc._id, 1);\n}',
      },
      recordRevisions: {
        map: `function (doc) {
              if (doc.record_format_version === 1)
                  if (doc.heads.length > 0) {
                      const conflict = doc.heads.length > 1;
                      const created = doc.created;
                      const type = doc.type;
                      emit(doc._id, {_id: doc.heads[0], conflict, created, type});
                  }
              }`,
      },
      revision: {
        map: 'function (doc) {\n  if (doc.revision_format_version === 1)  \n    emit(doc._id, 1);\n}',
      },
      avp: {
        map: 'function (doc) {\n  if (doc.avp_format_version === 1)\n    emit(doc._id, 1);\n}',
      },
      recordCount: {
        map: 'function (doc) {\n  if (doc.record_format_version === 1)\n    emit(doc._id, 1);\n}',
        reduce: '_count',
      },
    },
    language: 'javascript',
  });

  // add or update each of the documents
  for (let i = 0; i < documents.length; i++) {
    try {
      const existing = await dataDB.get(documents[i]._id);
      if (existing) {
        documents[i]['_rev'] = existing['_rev'];
        // are they the same?
        if (isEqualObjects(existing, documents[i])) {
          return;
        }
      }
      await dataDB.put(documents[i]);
    } catch (error) {
      try {
        await dataDB.put(documents[i]);
      } catch (error) {
        console.log('Error adding design documents to database:', error);
      }
    }
  }
};
