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
export async function safeWriteDocument<T extends {}>(
  db: PouchDB.Database<T>,
  data: PouchDB.Core.Document<T>,
  writeOnClash: boolean = true
) {
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
