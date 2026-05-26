import PouchDB from 'pouchdb';
import PouchDBSecurity from 'pouchdb-security-helper';
import {z} from 'zod';
import {DatabaseInterface} from '../types';
PouchDB.plugin(PouchDBSecurity);

// Zod schema for the document and existing document couch interfaces
export const CouchDocumentSchema = z.object({
  _id: z.string().min(1),
  _rev: z.string().min(1).optional(),
});
export const CouchExistingDocumentSchema = z.object({
  _id: z.string().min(1),
  _rev: z.string().min(1),
});

/**
 * Converts a JavaScript function to a CouchDB-compatible string representation.
 */
export function convertToCouchDBString(func: Function) {
  if (typeof func !== 'function') {
    throw new Error('Input must be a function');
  }

  return func.toString();
}

/**
 * Type definition for CouchDB design documents
 */
export type DesignDocument = {
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

export type SecurityDocument = {
  // Standard fields for a CouchDB security document
  admins: {
    names: string[];
    roles: string[];
  };
  members: {
    names: string[];
    roles: string[];
  };
};

/** Init methods produce this initialisation content. */
export type InitialisationContent<Document extends {} = any> = {
  designDocuments: DesignDocument[];
  securityDocument: SecurityDocument;
  defaultDocument?: Document;
};

/**
 * Safely writes a document to the database with automatic conflict resolution.
 *
 * This function attempts to write a document to the database. If a conflict (409 error)
 * occurs, behavior depends on the writeOnClash parameter.
 *
 * @param db - The database to write the document into
 * @param data - The document to write (must include _id, optionally includes _rev)
 * @param writeOnClash - If true, resolves conflicts by retrying with the latest _rev.
 *                       If false, returns undefined when a conflict is detected.
 *                       Default: true
 * @param maxRetries - Maximum number of retry attempts when conflicts occur.
 *                     Only applies when writeOnClash is true.
 *                     Default: 5
 *
 * @returns A Promise that resolves to:
 *   - The PouchDB response containing the new revision on success
 *   - undefined if a conflict occurs and writeOnClash is false
 *
 * @throws Error when:
 *   - Max retry attempts are exceeded during conflict resolution (writeOnClash = true)
 *   - A non-409 database error occurs
 *   - The document cannot be retrieved during conflict resolution
 */
export async function safeWriteDocument<T extends {}>({
  db,
  data,
  writeOnClash = true,
  maxRetries = 5,
}: {
  db: DatabaseInterface<T>;
  data: PouchDB.Core.Document<T>;
  writeOnClash?: boolean;
  maxRetries?: number;
}) {
  // Try to put directly - if no clash or _rev already provided, succeeds immediately
  try {
    return await db.put(data);
  } catch (err: any) {
    // If 409 - that's a conflict - handle based on writeOnClash setting
    if (err.status === 409) {
      if (writeOnClash) {
        // Retry logic: fetch latest _rev and attempt write again
        let attempts = 0;
        while (attempts < maxRetries) {
          try {
            const existingRecord = await db.get<T>(data._id);
            // Update _rev with latest version and retry the write
            return await db.put({...data, _rev: existingRecord._rev});
          } catch (retryErr: any) {
            attempts++;
            // If it's another 409 and we haven't hit max retries, continue loop
            if (retryErr.status === 409 && attempts < maxRetries) {
              continue;
            }
            // Either hit max retries or encountered a different error
            throw Error(
              `Failed to update record after ${attempts} attempt(s). ` +
                `Error: ${retryErr}`
            );
          }
        }
        // This shouldn't be reached, but just in case
        throw Error(`Failed to update record after ${maxRetries} retries`);
      } else {
        // Conflict occurred but writeOnClash is false - return undefined
        return undefined;
      }
    } else {
      // Non-conflict error occurred - log and throw
      console.log(err);
      throw Error('Failed to update record - non 409 error: ' + err);
    }
  }
}

/**
 * Efficiently writes multiple documents in a batch, handling conflicts
 */
export async function batchWriteDocuments<T extends {}>({
  db,
  documents,
  writeOnClash = true,
}: {
  db: DatabaseInterface<T>;
  documents: PouchDB.Core.ExistingDocument<T>[];
  writeOnClash?: boolean;
}): Promise<{successful: number; failed: number}> {
  let successful = 0;
  let failed = 0;

  // Process in smaller chunks to avoid memory build-up
  const CHUNK_SIZE = 10;

  for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
    const chunk = documents.slice(i, i + CHUNK_SIZE);

    try {
      // Try bulk insert first
      const results = await db.bulkDocs(chunk, {new_edits: true});

      // Handle any conflicts in the results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const doc = chunk[j];

        if (
          'error' in result &&
          result.error &&
          result.status === 409 &&
          writeOnClash
        ) {
          // Handle conflict individually
          try {
            const existing = await db.get<T>(doc._id);
            doc._rev = existing._rev;
            await db.put(doc);
            successful++;
          } catch (conflictErr) {
            console.warn(`Failed to resolve conflict for ${doc._id}`);
            failed++;
          }
        } else if ('error' in result) {
          failed++;
        } else {
          successful++;
        }
      }
    } catch (bulkErr) {
      // Fallback to individual writes for this chunk
      for (const doc of chunk) {
        try {
          await safeWriteDocument({db, data: doc, writeOnClash});
          successful++;
        } catch (err) {
          failed++;
        }
      }
    }

    // Allow garbage collection between chunks
    if (i % (CHUNK_SIZE * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  return {successful, failed};
}

/**
 * Will only write a document if it doesn't exist - safely checks the error code
 * from PUT.
 * @param db The database to write new document into
 * @param data The document to replace
 */
export async function writeNewDocument<T extends {}>({
  db,
  data,
}: {
  db: DatabaseInterface<T>;
  data: PouchDB.Core.Document<T>;
}): Promise<{
  wrote: boolean;
  _rev: string;
  existing?: PouchDB.Core.ExistingDocument<T>;
}> {
  try {
    // Try to get the existing document
    let existingDoc: PouchDB.Core.ExistingDocument<T> | undefined;
    try {
      existingDoc = await db.get(data._id);
    } catch (err: any) {
      // If the document doesn't exist, PouchDB will throw a 404 error
      if (err.status !== 404) {
        throw err;
      }
      existingDoc = undefined;
    }

    if (!existingDoc) {
      // Put the document (create only since it's new)
      const res = await db.put(data);
      return {wrote: true, _rev: res.rev, existing: undefined};
    } else {
      // Already exists - return it
      return {wrote: false, _rev: existingDoc._rev, existing: existingDoc};
    }
  } catch (error) {
    console.error(`Error creating new document ${data._id}:`, error);
    throw error;
  }
}

/**
 * Method to apply initialisation content to a database.
 *
 * @param db DatabaseInterface to initialise
 * @param content The documents to write
 * @param config.forceWrite Override on clash?
 * @param config.applyPermissions Actually write security document?
 */
export const couchInitialiser = async ({
  db,
  content,
  config: {forceWrite = false, applyPermissions = true} = {},
}: {
  db: DatabaseInterface;
  content: InitialisationContent;
  config?: {
    forceWrite?: boolean;
    applyPermissions?: boolean;
  };
}): Promise<void> => {
  // For each design document - write - forcing if necessary
  for (const designDoc of content.designDocuments) {
    // We only write over an existing document if the force argument is provided
    await safeWriteDocument({data: designDoc, db, writeOnClash: forceWrite});
  }
  // For security model - always write for now (unless asked not to)
  if (applyPermissions) {
    await db.security(content.securityDocument).save();
  }
  // Also write a default document, if one is provided
  if (content.defaultDocument) {
    await safeWriteDocument({
      data: content.defaultDocument,
      db,
      writeOnClash: forceWrite,
    });
  }
};

/**
 * Cross-platform hash function that works in both Node.js and browsers
 */
export async function createHash(data: string): Promise<string> {
  // Browser environment
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Node.js environment
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    } catch (error) {
      // Fallback if crypto is not available
      console.warn('Node.js crypto not available, falling back to simple hash');
    }
  }
  // If we can't load a module, throw an error
  throw new Error('Could not load crypto module for hashing');
}
