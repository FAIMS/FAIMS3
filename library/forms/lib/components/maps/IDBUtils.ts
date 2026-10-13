// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 * Shared IndexedDB utility functions.
 */

// Convert an IndexedDB request into a Promise so it can be awaited.
export async function requestAsPromise<T>(
  // IndexedDB request to wait for.
  request: IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Scan an object store with a cursor without loading all records into memory.
export async function scanStore(
  // Object store to scan.
  store: IDBObjectStore,
  // Function to run for each record found by the cursor.
  visit: (cursor: IDBCursorWithValue) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Open a cursor to iterate through the records in this object store.
    const request = store.openCursor();

    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to scan '${store.name}'`));

    request.onsuccess = () => {
      const cursor = request.result;

      // A null cursor means there are no more records to scan.
      if (!cursor) {
        resolve();
        return;
      }

      try {
        visit(cursor);
        cursor.continue();
      } catch (error) {
        reject(error);
      }
    };
  });
}

/**
 * Delete an IndexedDB database.
 */
export async function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    request.onblocked = () => {
      reject(new Error(`Deleting IndexedDB database '${dbName}' was blocked`));
    };
  });
}
