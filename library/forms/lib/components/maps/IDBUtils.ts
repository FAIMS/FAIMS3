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
 *
 * Description:
 *
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
