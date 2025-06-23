import PouchDB from 'pouchdb';
import PouchDBSecurity from 'pouchdb-security-helper';
import {z} from 'zod';
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
 * Gets a record, updates the _rev, then puts or gracefully returns if
 * writeOnClash is false.
 * @param db The database to upsert document into
 * @param data The document to replace
 * @param writeOnClash If the document already exists by ID, should it
 * overwrite?
 * @returns The updated document or document that was found if existing and
 * writeOnClash = false
 */
export async function safeWriteDocument<T extends {}>({
  db,
  data,
  writeOnClash = true,
}: {
  db: PouchDB.Database<T>;
  data: PouchDB.Core.Document<T>;
  writeOnClash?: boolean;
}) {
  // Try and put directly - if no clash or _rev already provided, all good
  try {
    await db.put(data);
  } catch (err: any) {
    // if 409 - that's conflict - get record then try again
    if (err.status === 409) {
      if (writeOnClash) {
        try {
          const existingRecord = await db.get<T>(data._id);
          // Update _rev and otherwise put the original record
          await db.put({...data, _rev: existingRecord._rev});
        } catch (err) {
          throw Error('Failed to update record in conflict. Error: ' + err);
        }
      }
    } else {
      // Something else happened - unsure and throw
      throw Error('Failed to update record - non 409 error' + err);
    }
  }
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
  db: PouchDB.Database<T>;
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
 * @param db PouchDB.Database to initialise
 * @param content The documents to write
 * @param config.forceWrite Override on clash?
 * @param config.applyPermissions Actually write security document?
 */
export const couchInitialiser = async ({
  db,
  content,
  config: {forceWrite = false, applyPermissions = true} = {},
}: {
  db: PouchDB.Database;
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
