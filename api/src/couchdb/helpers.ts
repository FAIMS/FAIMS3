/**
 * Gets a record, updates the _rev, then puts.
 * @param db The database to upsert document into
 * @param data The document to replace
 * @returns The updated document (response from put)
 */
export async function upsertDocument<T extends {}>(
  db: PouchDB.Database<T>,
  data: PouchDB.Core.Document<T>
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
