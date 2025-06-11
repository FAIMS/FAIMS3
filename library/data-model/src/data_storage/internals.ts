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
 * Filename: internals.ts
 * Description:
 *   Helper functions to handle converting data between the GUI and pouchdb.
 */

import {v4 as uuidv4} from 'uuid';
import {HRID_STRING} from '../datamodel/core';
import {
  getAttachmentDumperForType,
  getAttachmentLoaderForType,
  getEqualityFunctionForType,
} from '../datamodel/typesystem';
import {
  getHridFieldMap,
  getHridFieldNameForViewset,
  getIdsByFieldName,
  HridFieldMap,
} from '../utils';
import {
  Annotations,
  AttributeValuePair,
  AttributeValuePairID,
  AttributeValuePairIDMap,
  DataDbType,
  EncodedRecord,
  FAIMSAttachment,
  FAIMSTypeName,
  ProjectID,
  ProjectUIModel,
  Record,
  RecordID,
  RecordMetadata,
  Revision,
  RevisionID,
  UnhydratedRecord,
} from '../types';
import {createHash} from './utils';

// INDEX NAMES

// List of records
export const RECORDS_INDEX = 'index/record';
// List of revisions
export const REVISIONS_INDEX = 'index/revision';
// List of AVP items
export const AVP_INDEX = 'index/avp';
// ID = record id, emitted = revision - use include_docs
export const RECORD_REVISIONS_INDEX = 'index/recordRevisions';

// TYPE FIELDS

export const REVISION_TYPE_FIELD = 'revision_format_version';
export const RECORD_TYPE_FIELD = 'record_format_version';
export const AVP_TYPE_FIELD = 'avp_format_version';

export interface FormData {
  data: {[field_name: string]: any};
  annotations: {[field_name: string]: Annotations};
  types: {[field_name: string]: FAIMSTypeName};
}

export function generateFAIMSRevisionID(): RevisionID {
  return 'frev-' + uuidv4();
}

export function generateFAIMSAttributeValuePairID(): AttributeValuePairID {
  return 'avp-' + uuidv4();
}

/**
 * Efficiently retrieves a single document by ID with optional type validation.
 *
 * Uses the direct get() method which is more efficient than queries for single
 * document retrieval.
 *
 * @param db PouchDB.Database to query
 * @param id The document ID to retrieve
 * @param typeField? field name that contains type information
 * @param conflicts? Whether to include conflict information (defaults to false)
 *
 * @returns The requested document of the specified type or null if not
 * found/invalid type
 */
export async function getCouchDocument<DocType extends {[key: string]: any}>({
  db,
  id,
  typeField = undefined,
  conflicts = false,
}: {
  db: PouchDB.Database;
  id: string;
  typeField?: string;
  conflicts?: boolean;
}): Promise<PouchDB.Core.ExistingDocument<DocType> | undefined> {
  try {
    // Get is the most efficient method for single document retrieval
    const doc = (await db.get(id, {
      conflicts,
    })) as PouchDB.Core.ExistingDocument<DocType>;

    // Validate the document type if expectedType is provided
    if (typeField && !doc[typeField]) {
      // Document exists but is not of the expected type
      throw Error(
        'The document was identified, but did not match the expected type. Missing the type field: ' +
          typeField
      );
    }

    return doc;
  } catch (error: any) {
    // Handle document not found errors specifically
    if (error.name === 'not_found') {
      return undefined;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * A helper function which queries couch. Can either use the allDocs if no index
 * is provided, or use the query with the index if provided. Allows
 * configuration of the keys to filter on (if any), as well as the index and
 * conflicts.
 *
 * @param db PouchDB.Database to query
 * @param index? index name e.g. index/recordRevisions
 * @param keys? list of keys to filter if any - if not provided gets all records in index
 * @param conflicts? include conflict info in query
 *
 * @returns List of specified record type
 */
export async function queryCouch<DocType extends {}>({
  keys = undefined,
  db,
  index = undefined,
  conflicts = true,
  binary = false,
  attachments = false,
}: {
  db: PouchDB.Database;
  index?: string;
  keys?: string[];
  conflicts?: boolean;
  binary?: boolean;
  attachments?: boolean;
}): Promise<PouchDB.Core.ExistingDocument<DocType>[]> {
  let result;

  // If index is not provided - do all docs
  if (!index) {
    result = await db.allDocs({
      include_docs: true,
      conflicts,
      binary,
      attachments,
      // Only include keys if provided
      ...(keys ? {keys} : {}),
    });
  } else {
    // index provided, do a query
    result = await db.query(index, {
      include_docs: true,
      conflicts,
      binary,
      attachments,
      // Only include keys if provided
      ...(keys ? {keys} : {}),
    });
  }

  // Do type casting to get the right record type - noting that this is risky
  return result.rows
    .filter((row: any) => row.doc !== undefined && row.doc !== null)
    .map((row: any) => row.doc as PouchDB.Core.ExistingDocument<DocType>);
}

/**
 * Updates the heads and revisions of a record when a new revision is created.
 *
 * This function manages the revision history of a document by:
 * 1. Adding a new revision ID to the document's heads
 * 2. Removing base revision IDs from the heads (as they're now superseded)
 * 3. Adding the new revision ID to the document's complete revision history
 * 4. Saving the updated document back to the database
 *
 * The function handles fast-forward merges by using Sets to prevent duplicate
 * entries when the new revision might already be present in the document's
 * revision history.
 *
 * @param dataDb - The database instance to operate on
 * @param recordId - The ID of the record to update
 * @param baseRevisionId - Array of revision IDs that the new revision is based
 * on (to be removed from heads)
 * @param newRevisionId - The ID of the new revision to add to heads and
 * revision history
 *
 * @throws Error if the specified record cannot be found in the database
 */
export async function updateHeads({
  newRevisionId: newRevisionId,
  baseRevisionId: baseRevisionId,
  recordId: recordId,
  dataDb,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
  baseRevisionId: RevisionID[];
  newRevisionId: RevisionID;
}) {
  const record = await getCouchDocument<EncodedRecord>({
    db: dataDb,
    id: recordId,
    conflicts: true,
  });

  if (!record) {
    throw new Error(
      'Cannot update heads for missing document. ID: ' + recordId
    );
  }

  // Add new revision to heads, removing obsolete heads. Using set in case we
  // have the revision already (i.e. we're cleaning up heads via a fast-forward
  // merge)
  const heads = new Set<RevisionID>(record.heads);
  heads.add(newRevisionId);
  for (const r of baseRevisionId) {
    heads.delete(r);
  }
  record.heads = Array.from(heads);
  record.heads.sort();

  // Add new head to revisions also. Using set in case we have the revision
  // already (i.e. we're cleaning up heads via a fast-forward merge)
  const revisions = new Set<RevisionID>(record.revisions);
  revisions.add(newRevisionId);
  record.revisions = Array.from(revisions);
  record.revisions.sort();

  await dataDb.put(record);
}

/**
 * Resolves conflicts for a record by merging the revision information from all
 * conflicting versions.
 *
 * In CouchDB, conflict resolution requires selecting one revision as the
 * "winner" and removing others. This function:
 *
 * 1. Uses the current document as the base revision
 * 2. Retrieves all conflicting document revisions
 * 3. Merges the `heads` and `revisions` arrays from all conflicting documents
 * 4. Marks all conflicting revisions as deleted while preserving their revision
 *    history
 * 5. Updates the database with the merged document and the deletion markers
 *
 * This approach preserves the complete revision history across all branches,
 * ensuring no revision data is lost during conflict resolution.
 *
 * @param dataDb - The PouchDB/CouchDB database instance
 * @param record - The current document with potential conflicts
 * @returns The updated record with merged revision history and resolved
 * conflicts
 */
export async function mergeRecordConflicts({
  dataDb,
  record,
}: {
  dataDb: DataDbType;
  record: EncodedRecord;
}): Promise<EncodedRecord> {
  // There is no merge functionality in couchdb, you pick a revision and delete
  // the others. Let's use the default revision selected as the base for
  // consistency.
  if (record._conflicts === undefined) {
    // If there are no actual conflicts, just return as per normal
    return record;
  }

  // Get current heads, revisions as sets for easy merging
  const heads = new Set<RevisionID>(record.heads);
  const revisions = new Set<RevisionID>(record.revisions);

  // Get the additional conflicted revisions
  const conflictedDocs = await dataDb.get(record._id, {
    open_revs: record._conflicts,
  });
  const newDocs: EncodedRecord[] = [];
  for (const doc of conflictedDocs) {
    const tmpRecord = doc.ok as EncodedRecord;
    // Add heads
    for (const rev of tmpRecord.heads) {
      heads.add(rev);
    }
    // Add revisions
    for (const rev of tmpRecord.revisions) {
      revisions.add(rev);
    }
    // We will delete the additional revisions
    tmpRecord._deleted = true;
    newDocs.push(tmpRecord);
  }
  record.heads = Array.from(heads);
  record.heads.sort();
  record.revisions = Array.from(revisions);
  record.revisions.sort();
  newDocs.push(record);
  await dataDb.bulkDocs(newDocs);
  return record;
}

/**
 * Finds the revision - validating type.
 * @returns Revision or throws error
 */
export async function getRevision({
  dataDb,
  revisionId,
}: {
  dataDb: DataDbType;
  revisionId: RevisionID;
}): Promise<PouchDB.Core.ExistingDocument<Revision>> {
  try {
    const result = await getCouchDocument<Revision>({
      db: dataDb,
      id: revisionId,
      typeField: REVISION_TYPE_FIELD,
    });
    if (result) {
      return result;
    } else {
      throw Error('Revision not found.');
    }
  } catch (e) {
    throw Error(
      `Could not find the revision with ID ${revisionId}. Error: ${e}.`
    );
  }
}

/**
 * Finds the AVP - validating type.
 * @returns Revision or throws error
 */
export async function getAvp({
  dataDb,
  avpId,
}: {
  dataDb: DataDbType;
  avpId: AttributeValuePairID;
}): Promise<AttributeValuePair> {
  try {
    const result = await getCouchDocument<AttributeValuePair>({
      db: dataDb,
      id: avpId,
      typeField: AVP_TYPE_FIELD,
    });
    if (result) {
      return result;
    } else {
      throw Error('AVP not found.');
    }
  } catch (e) {
    throw Error(`Could not find the AVP with ID ${avpId}. Error: {e}.`);
  }
}

/**
 * Returns the recommended HRID for this record (which is a revision) - this is
 * achieved by a) get the ui spec for the project b) look at fields in the
 * revision (via avp keys) c) determine which viewset these fields are in d)
 * getting the HRID for that viewset which is either i) the top level configured
 * hridField for new notebooks or ii) a field starting with hrid...  for the old
 * style. Returns the value of the HRID field, not the field name.
 *
 * If null is returned, typically a parent would use the record_id as a backup.
 *
 * @param projectId The project ID for which to ascertain the HRID
 * @param revision The revision - this reflects a particular version of a
 * response
 * @returns The recommended HRID for this revision/record
 */
export async function getHRID({
  revision,
  uiSpecification,
  dataDb,
}: {
  revision: Revision;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<string | null> {
  let hridFieldName = undefined;

  // iterate through field names, trying our very best to find one that is
  // described in the uispec appropriately. Unless the uispec is very broken,
  // this should succeed.
  const fieldNames = Array.from(Object.keys(revision.avps));
  for (const candidateFieldName of fieldNames) {
    try {
      const {viewSetId} = getIdsByFieldName({
        uiSpecification,
        fieldName: candidateFieldName,
      });
      // get the HRID for the view set - might not succeed
      hridFieldName = getHridFieldNameForViewset({
        uiSpecification,
        viewSetId,
      });
      if (hridFieldName) {
        break;
      }
    } catch (e) {
      console.log(
        `Could not find suitable viewset/HRID for field name: ${candidateFieldName}. Error: ${e}.`
      );
    }
  }

  // only try the backup if necessary
  if (!hridFieldName) {
    for (const possible_name of Object.keys(revision.avps)) {
      if (possible_name.startsWith(HRID_STRING)) {
        hridFieldName = possible_name;
        break;
      }
    }
  }

  if (!hridFieldName) {
    return null;
  }
  const hridAvpId = revision.avps[hridFieldName];
  if (hridAvpId === undefined) {
    console.warn('No HRID field set for revision');
    return null;
  }
  try {
    const hrid_avp = await getAvp({avpId: hridAvpId, dataDb});
    return hrid_avp.data as string;
  } catch (err) {
    console.warn('Failed to load HRID AVP:', hridAvpId);
    return null;
  }
}

/**
 * Retrieves all field data for a specific revision by fetching associated AVPs in parallel.
 *
 * This function takes a project ID, revision object, and database connection, then
 * retrieves and assembles all the attribute-value pairs (AVPs) associated with the
 * revision into a single object. All AVP fetching operations run concurrently for
 * improved performance.
 *
 * @param projectId - The ID of the project containing this revision
 * @param revision - The revision object containing AVP references
 * @param dataDb - Database connection for retrieving AVP data
 *
 * @returns A promise that resolves to an object mapping field names to their values,
 *          or undefined if any AVP retrieval fails
 */
export async function getDataForRevision({
  revision,
  dataDb,
}: {
  revision: {avps: AttributeValuePairIDMap};
  dataDb: DataDbType;
}): Promise<{[fieldName: string]: any} | undefined> {
  // Create an array to hold all of our AVP fetch promises
  const avpPromises: Array<Promise<[string, any]>> = [];

  // Launch all AVP fetch operations in parallel
  for (const fieldName in revision.avps) {
    const avpId = revision.avps[fieldName];

    // For each field, create a promise that resolves to a [fieldName, value] tuple
    // Use explicit type assertion to fix the TypeScript error
    const avpPromise = getAvp({avpId, dataDb})
      .then(avp => [fieldName, avp.data] as [string, any])
      .catch(err => {
        console.warn('Failed to load AVP:', fieldName, err);
        // Re-throw to be caught by Promise.all
        throw new Error(`Failed to load AVP for field ${fieldName}`);
      });

    avpPromises.push(avpPromise);
  }

  try {
    // Wait for all promises to resolve in parallel
    const fieldEntries = await Promise.all(avpPromises);

    // Convert array of [key, value] pairs into a single object
    return Object.fromEntries(fieldEntries);
  } catch (err) {
    // If any promise fails, return undefined
    return undefined;
  }
}

/**
 * Retrieves a list of non-deleted record metadata.
 *
 *
 * This function fetches records based on optional filtering criteria, retrieves
 * their latest revisions, and constructs metadata objects containing record
 * information along with human-readable identifiers (HRIDs) determined by the
 * UI specification.
 *
 * If hydrate is set to true, then the data and hrid fields will be populated.
 * NOTE that this incurs additional queries (since we need to fetch AVPs for
 * every field in the response).
 *
 * @param projectId - The project identifier
 * @param recordIds - Optional array of specific record IDs to retrieve
 * @param hydrate - should AVPs be fetched to allow data and hrid to be populated?
 * @param uiSpecification - UI model containing HRID field configurations
 * @param dataDb - Database connection for retrieving record data
 *
 * @returns {Promise<RecordMetadata[]>} A promise that resolves to an array of
 * record metadata objects
 * @throws {Error} If record retrieval fails
 */
export async function listRecordMetadata({
  projectId,
  recordIds,
  uiSpecification,
  dataDb,
  hydrate = true,
}: {
  projectId: ProjectID;
  recordIds?: RecordID[];
  hydrate?: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<RecordMetadata[]> {
  try {
    // Based on the UI spec, establish the ideal HRID for each viewset - this
    // can be done once since all records are part of the same project/spec

    // Only needs to be done if hydrating records.
    let hridFieldMap = undefined;
    if (hydrate) {
      hridFieldMap = getHridFieldMap(uiSpecification);
    }

    // Get records - either allDocs or query from index based on provision of
    // recordIds filter
    const rawRecords = await getRecords({
      recordIds,
      dataDb,
    });

    // Process records in parallel using Promise.all with map. Each record is
    // hydrated with data, HRID derived, and processed.
    const recordMetadataPromises = rawRecords.map(async record => {
      try {
        const revId = record.heads[0];

        // Skip if revision not found
        if (!revId) {
          console.warn(
            `There exists a record in the data DB with no heads[0]. Id: ${record._id}`
          );
          return null;
        }

        const revision = await getRevision({dataDb: dataDb, revisionId: revId});

        // Skip if revision not found
        if (!revision) {
          console.warn(
            `There exists a record in the data DB with a revision which is missing. ID: ${record._id}. Revision ID: ${revId}`
          );
          return null;
        }

        // Get data for the revision and hrid (if hydrate == true)
        let data = undefined;
        let hrid = undefined;
        if (hydrate && hridFieldMap) {
          // Hydrate with data by fetching AVPs
          data = await getDataForRevision({dataDb, revision});

          // Ensure it's defined
          if (!data) {
            console.warn(
              `There exists a record in the data DB where data hydration failed. ID: ${record._id}. Revision ID: ${revId}`
            );
            return null;
          }

          // Determine HRID based on field mapping or fall back to record ID
          const hridFieldName = hridFieldMap[revision.type];
          hrid =
            (hridFieldName ? data[hridFieldName] : record._id) ?? record._id;
        }

        // Return record metadata
        return {
          project_id: projectId,
          record_id: record._id,
          revision_id: revId,
          created: new Date(record.created),
          created_by: record.created_by,
          updated: new Date(revision.created),
          updated_by: revision.created_by,
          conflicts: record.heads.length > 1,
          deleted: revision.deleted ? true : false,
          type: record.type,
          relationship: revision.relationship,
          avps: revision.avps,

          // If hydrate == true these will be defined
          data: data,
          hrid: hrid,
        } satisfies RecordMetadata;
      } catch (e) {
        console.error(
          `Failed to get record information. Record ID ${record._id}. Project ID ${projectId}. Due to error: ${e}.`
        );
        return null;
      }
    });

    // Resolve all promises and filter out null values (skipped records)
    const results = await Promise.all(recordMetadataPromises);
    return results.filter(item => item !== null);
  } catch (err) {
    console.log(err);
    throw Error(`failed to get metadata. ${err}`);
  }
}

/**
 * Hydrates an individual record by fetching AVPs to populate the data and hrid
 * fields.
 *
 * can use a provided hrid viewset ID -> field name map, or generate it's own.
 *
 * @param record The record to hydrate - not modified, a new one provided
 * @param uiSpecification The ui spec (used for hrid field mapping)
 * @param dataDb The data DB containing the AVPs etc
 * @param hridFieldMap The hrid field map if provided to avoid recomputation
 *
 * @returns
 */
export async function hydrateIndividualRecord({
  record,
  uiSpecification,
  dataDb,
  hridFieldMap: providedFieldMap = undefined,
}: {
  record: UnhydratedRecord;
  hridFieldMap?: HridFieldMap;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<RecordMetadata> {
  // Only needs to be done if not provided
  const hridFieldMap = providedFieldMap ?? getHridFieldMap(uiSpecification);

  // Hydrate with data by fetching AVPs
  const data = await getDataForRevision({
    dataDb,
    revision: {avps: record.avps},
  });

  // Ensure it's defined
  if (!data) {
    throw new Error(
      `There exists a record in the data DB where data hydration failed. ID: ${record.record_id}. Revision ID: ${record.revision_id}`
    );
  }

  // Determine HRID based on field mapping or fall back to record ID
  const hridFieldName = hridFieldMap[record.type];
  const hrid =
    (hridFieldName ? data[hridFieldName] : record.record_id) ??
    record.record_id;

  // Return record with populated data
  return {...record, data, hrid} satisfies RecordMetadata;
}

/**
 * Retrieves attribute-value pairs (AVPs) from the database and loads their attachments.
 *
 * This function fetches multiple AVP documents by their IDs, ensuring all binary
 * attachments are properly loaded. It returns a map where keys are AVP IDs and
 * values are the corresponding AVP documents.
 *
 * @param dataDb - Database connection for retrieving AVP data
 * @param avpIds - Array of attribute-value pair IDs to retrieve
 *
 * @returns Mapping of AVP IDs to their document objects
 * @throws {Error} If the AVP retrieval or attachment loading fails
 */
export async function getAttributeValuePairs({
  dataDb,
  avpIds,
}: {
  dataDb: DataDbType;
  avpIds: AttributeValuePairID[];
}): Promise<{
  [id: string]: PouchDB.Core.ExistingDocument<AttributeValuePair>;
}> {
  // Early return for empty input
  if (!avpIds || avpIds.length === 0) {
    return {};
  }

  try {
    // Query the database for AVP documents
    const avpDocs = await queryCouch<AttributeValuePair>({
      keys: avpIds,
      db: dataDb,
      index: AVP_INDEX,
      conflicts: false,
    });

    // Process all attachment loading operations in parallel
    await Promise.all(
      avpDocs.map(avp => loadAttributeValuePair({avp, dataDb}))
    );

    // Build and return the document map
    return buildDocumentMap({docs: avpDocs});
  } catch (error) {
    throw new Error(`Failed to retrieve attribute-value pairs: ${error}`);
  }
}

/**
 * Get revisions of specified Ids using the revision index
 * @returns List of revision documents
 */
export async function getRevisions({
  revisionIds,
  dataDb,
}: {
  revisionIds: RevisionID[];
  dataDb: DataDbType;
}): Promise<PouchDB.Core.ExistingDocument<Revision>[]> {
  return await queryCouch<Revision>({
    db: dataDb,
    conflicts: false,
    index: REVISIONS_INDEX,
    keys: revisionIds,
  });
}

/**
 * Efficiently builds a map of ID -> document without creating intermediate arrays.
 *
 * @param docs - Array of PouchDB documents to map
 * @returns An object mapping document IDs to their corresponding documents
 */
export function buildDocumentMap<Content extends {}>({
  docs,
}: {
  docs: PouchDB.Core.ExistingDocument<Content>[];
}): {[id: string]: PouchDB.Core.ExistingDocument<Content>} {
  return docs.reduce(
    (map, doc) => {
      map[doc._id] = doc;
      return map;
    },
    {} as {[id: string]: PouchDB.Core.ExistingDocument<Content>}
  );
}

/**
 * Get the Record documents ('rec-') for an array of record ids
 *
 * @returns List of EncodedRecord
 */
export async function getRecord({
  recordId,
  dataDb,
}: {
  recordId: RecordID;
  dataDb: DataDbType;
}): Promise<PouchDB.Core.ExistingDocument<EncodedRecord> | undefined> {
  return await getCouchDocument<EncodedRecord>({
    db: dataDb,
    id: recordId,
    typeField: RECORD_TYPE_FIELD,
  });
}

/**
 * Creates a canonical hash from the record audit data for efficient sync checking.
 *
 * @param audit - Array of {id, rev} objects from getRecordAudit
 * @returns SHA-256 hash of the canonical representation
 */
async function createAuditHash(
  audit: Array<{id: string; rev: string}>
): Promise<string> {
  // The audit is already sorted by ID in getRecordAudit, but ensure consistency
  const sortedAudit = audit
    .slice() // Don't mutate original
    .sort((a, b) => a.id.localeCompare(b.id));

  // Create canonical JSON representation
  const canonicalJson = JSON.stringify(sortedAudit);

  // Return SHA-256 hash
  return await createHash(canonicalJson);
}

/**
 * Generate an audit for a record.
 * This returns a list of all document ids and revision ids for documents
 * making up this record.  All frevs, avps and attachment documents.
 *
 * We can then use this in the client to verify that we have a complete and
 * up to date copy of the record on the server.
 *
 */
export async function getRecordAudit({
  recordId,
  dataDb,
}: {
  recordId: RecordID;
  dataDb: DataDbType;
}) {
  // need to get the record itself and then query for all
  // documents that reference this record ID
  const record = await getCouchDocument<EncodedRecord>({
    db: dataDb,
    id: recordId,
    typeField: RECORD_TYPE_FIELD,
  });
  if (record) {
    const parts = await dataDb.find({
      selector: {
        record_id: recordId,
      },
      fields: ['_id', '_rev'],
      limit: 1000,
    });
    const audit = [
      {
        id: recordId,
        rev: record._rev,
      },
      ...parts.docs.map(doc => ({
        id: doc._id,
        rev: doc._rev,
      })),
    ];
    return createAuditHash(audit);
  } else {
    throw new Error(`Record ${recordId} not found`);
  }
}

export type RecordAuditMap = {
  [recordId: string]: string;
};

export async function getRecordListAudit({
  recordIds,
  dataDb,
}: {
  recordIds: RecordID[];
  dataDb: DataDbType;
}) {
  const result: RecordAuditMap = {};
  for (const recordId of recordIds) {
    result[recordId] = await getRecordAudit({
      recordId,
      dataDb,
    });
  }
}

/**
 * Get the Record documents ('rec-') for an array of record ids
 *
 * @returns List of EncodedRecord
 */
export async function getRecords({
  recordIds,
  dataDb,
}: {
  recordIds?: RecordID[];
  dataDb: DataDbType;
}): Promise<PouchDB.Core.ExistingDocument<EncodedRecord>[]> {
  return await queryCouch<EncodedRecord>({
    db: dataDb,
    conflicts: false,
    index: RECORDS_INDEX,
    keys: recordIds,
  });
}

/**
 * Deeply hydrates form data from the revision - i.e. fetches all data and
 * attachments. This is an expensive operation!
 * @returns Fully hydrated form data including attachments if available.
 */
export async function getFormDataFromRevision({
  revision,
  dataDb,
}: {
  dataDb: DataDbType;
  revision: Revision;
}): Promise<FormData> {
  // Scaffold
  const form_data: FormData = {
    data: {},
    annotations: {},
    types: {},
  };

  // Get relevant avps and then populate (including fetching attachments)
  const avp_ids = Object.values(revision.avps);
  const avps = await getAttributeValuePairs({avpIds: avp_ids, dataDb});

  for (const [name, avp_id] of Object.entries(revision.avps)) {
    form_data.data[name] = avps[avp_id].data;
    form_data.annotations[name] = avps[avp_id].annotations;
    form_data.types[name] = avps[avp_id].type;
  }
  return form_data;
}

/**
 * Builds a new revision by
 *
 * a) looking through all data, creating new AVPs for changed data (or new data)
 * b) determining if the existing record already had a revision - if so we record this as the parent
 * c) pushing the updated revision document to the data DB with the new AVPs in tow
 *
 * @param record The record to publish (with new data in it)
 * @param dataDb The data DB to write to
 * @param newRevId The ID provided for the new revision
 */
export async function addNewRevisionFromForm({
  record,
  dataDb,
  newRevId,
}: {
  dataDb: DataDbType;
  record: Record;
  newRevId: RevisionID;
}) {
  // Build and push the new AVPs
  const avpMap = await addNewAttributeValuePairs({dataDb, record, newRevId});

  // Work out if the record has any parent (i.e. previous revision that we worked from)
  const parents = record.revision_id === null ? [] : [record.revision_id];

  // Build the new revision document, including the reference to the parent
  const updatedRevision: Revision = {
    _id: newRevId,
    revision_format_version: 1,
    avps: avpMap,
    record_id: record.record_id,
    parents: parents,
    created: record.updated.toISOString(),
    created_by: record.updated_by,
    type: record.type,
    ugc_comment: record.ugc_comment,
    relationship: record.relationship,
  };
  await dataDb.put(updatedRevision);
}

/**
 * This method takes a set of updated form data and produces, dumps and writes
 * new AVPs where the data has changed based on the previous data for the given
 * record revision.
 * @returns A map of field name -> new AVP Id
 */
async function addNewAttributeValuePairs({
  dataDb,
  record,
  newRevId,
}: {
  dataDb: DataDbType;
  record: Record;
  newRevId: RevisionID;
}): Promise<AttributeValuePairIDMap> {
  // Start to construct the new avp map - mapping field name -> new AVP
  const avpMap: AttributeValuePairIDMap = {};
  let revision;
  let data;

  // If the record already has a revision id - then we should retrieve the
  // existing data etc from it
  if (record.revision_id !== null) {
    // Fetch the revision
    revision = await getRevision({dataDb, revisionId: record.revision_id});
    // Get the data from that revision (by hydrating AVPs)
    data = await getFormDataFromRevision({dataDb, revision});
  } else {
    revision = {};
    data = {
      data: {},
      annotations: {},
      types: {},
    };
  }

  // Start to build up a list of documents to push to the DB - this includes
  // both AVPs and also dumped attachments
  const documentsToWrite: Array<AttributeValuePair | FAIMSAttachment> = [];

  // Iterate through the field values - these are the proposed changes
  for (const [fieldName, fieldValue] of Object.entries(record.data)) {
    // Have a look at what data we already have here - along with annotations
    const storedData = data.data[fieldName];
    const storedAnnotation = data.annotations[fieldName];

    // Check if the value that was previously stored (if any) === proposed new value
    const equalityFunction = getEqualityFunctionForType(
      record.field_types[fieldName]
    );

    // data has changed if either the existing data is undefined OR there is a diff
    const hasDataChanged =
      storedData === undefined
        ? true
        : !(await equalityFunction(storedData, fieldValue));

    // annotation has changed if either existing is undefined OR there is a diff
    const hasAnnotationChanged =
      storedAnnotation === undefined
        ? true
        : !(await equalityFunction(
            storedAnnotation,
            record.annotations[fieldName]
          ));

    // If anything has changed - then we produce a new AVP ID
    if (hasDataChanged || hasAnnotationChanged) {
      // Get unique ID
      const newAvpId = generateFAIMSAttributeValuePairID();
      // Build the new AVP
      const newAvp = {
        _id: newAvpId,
        avp_format_version: 1,
        type: record.field_types[fieldName] ?? '??:??',
        data: fieldValue,
        revision_id: newRevId,
        record_id: record.record_id,
        annotations: record.annotations[fieldName],
        created: record.updated.toISOString(),
        created_by: record.updated_by,
      };
      // Dump out attachment if present and add AVP to docs
      documentsToWrite.push(...dumpAttributeValuePair(newAvp));
      // Set map
      avpMap[fieldName] = newAvpId;
    } else {
      if (revision.avps !== undefined) {
        avpMap[fieldName] = revision.avps[fieldName];
      } else {
        // This should not happen, as if stored_data === field_value and
        // stored_data is not undefined, then then revision.avps should be
        // defined
        throw Error(
          'Unexpected state while producing AVPs - the existing data is defined but there is a missing avp ID for this revision which contains the data.'
        );
      }
    }
  }
  // Write all updates
  await dataDb.bulkDocs(documentsToWrite);
  return avpMap;
}

/**
 * This function is used to ensure that there is a Record in the database for
 * the given record ID and revision.
 *
 * If this method fails due to a prior existing record, that is fine as we just
 * want to ensure such a parent record exists.
 * @param record The record to initialise
 * @param revision_id The revision ID of the head
 * @param dataDb The data db
 */
export async function initialiseRecordForNewRevision({
  record,
  revision_id,
  dataDb,
}: {
  dataDb: DataDbType;
  record: Record;
  revision_id: RevisionID;
}) {
  // build out the new record - noting the singleton revision ID and heads
  const new_encoded_record = {
    _id: record.record_id,
    record_format_version: 1,
    created: record.updated.toISOString(),
    created_by: record.updated_by,
    revisions: [revision_id],
    heads: [revision_id],
    type: record.type,
  } satisfies EncodedRecord;
  try {
    await dataDb.put(new_encoded_record);
  } catch (err) {
    // if there was an error then the document exists
    // already which is fine
  }
}

/**
 * Loads attachment referenced in the AVP by ID into actual data in the AVP.
 * @returns in place updated avp
 */
async function loadAttributeValuePair({
  avp,
  dataDb,
}: {
  avp: AttributeValuePair;
  dataDb: DataDbType;
}): Promise<AttributeValuePair> {
  const attachmentRefs = avp.faims_attachments;
  if (attachmentRefs === null || attachmentRefs === undefined) {
    // No attachments
    return avp;
  }
  // Work out how to load the attachment
  const loader = getAttachmentLoaderForType(avp.type);

  if (loader === null) {
    return avp;
  }

  // establish which IDs for attachments to fetch
  const attachmentIds = attachmentRefs.map(ref => ref.attachment_id);

  // fetch from database filtering on the keys we want, including attachments
  const res = await dataDb.allDocs({
    include_docs: true,
    attachments: true,
    binary: true,
    keys: attachmentIds,
  });

  // Go through rows, filter undefined docs, and cast as attachment
  const rows = res.rows;
  const attachedDocs: FAIMSAttachment[] = rows
    .filter((r: any) => r.doc !== undefined)
    .map((r: any) => {
      return r.doc as FAIMSAttachment;
    });

  // Use loader to populate AVP with attachments
  return loader(avp, attachedDocs);
}

/*
 * This handles converting data to attachments
 */
function dumpAttributeValuePair(
  avp: AttributeValuePair
): Array<AttributeValuePair | FAIMSAttachment> {
  const dumper = getAttachmentDumperForType(avp.type);
  if (dumper === null) {
    return [avp];
  }
  return dumper(avp);
}
