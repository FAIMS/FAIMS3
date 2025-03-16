import PouchDB from 'pouchdb';
import PouchDBSecurity from 'pouchdb-security-helper';
PouchDB.plugin(PouchDBSecurity);

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
 * Builds a role name for use in the couch DB security document from the project
 * ID + role name
 * @returns Role
 */
export const buildCouchRoleFromProjectId = ({
  projectId,
  role,
}: {
  projectId: string;
  role: string;
}): string => {
  return `${projectId}||${role}`;
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
  try {
    // Try to get the existing document
    let existingDoc;
    try {
      existingDoc = await db.get(data._id);
    } catch (err: any) {
      // If the document doesn't exist, PouchDB will throw a 404 error
      if (err.status !== 404) {
        throw err;
      }
    }

    if (existingDoc && !writeOnClash) {
      // We don't overwrite an existing doc if writeOnClash is not true
      return existingDoc;
    }

    // If the document exists, include its revision (which is overridden to be
    // latest ensuring it is upserted)
    const upsertData = {...data, _rev: existingDoc?._rev};

    // Put the document (create or update)
    const response = await db.put(upsertData);

    return response;
  } catch (error) {
    console.error(`Error upserting document ${data._id}:`, error);
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
