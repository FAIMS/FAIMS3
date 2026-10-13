// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 * Shared migration test utility functions.
 */

import {requestAsPromise} from '../../IDBUtils';
import type {TileDbMigrationFunction} from '../types';

/**
 * Convert an IndexedDB transaction into a Promise so tests can wait for it
 * to complete or abort.
 */
export function transactionAsPromise(
  // IndexedDB transaction to wait for.
  transaction: IDBTransaction
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();

    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));

    transaction.onerror = () => {
      // The transaction will abort after an unhandled request error.
      console.error('IndexedDB transaction error', transaction.error);
    };
  });
}

/**
 * Read all records from an object store.
 */
export async function readAll<T>(
  // Database to read from.
  db: IDBDatabase,
  // Object store to read all records from.
  storeName: string
): Promise<T[]> {
  const transaction = db.transaction(storeName, 'readonly');

  const result = await requestAsPromise(
    transaction.objectStore(storeName).getAll()
  );

  await transactionAsPromise(transaction);

  return result as T[];
}

/**
 * Create a test tile database at the requested IndexedDB version.
 */
export async function openDbForTest(
  // Name of the temporary IndexedDB database used by the test.
  dbName: string,
  // IndexedDB version to open/create.
  version: number,
  // Defines the schema to create when the database is upgraded.
  onUpgrade: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = () => {
      onUpgrade(request.result);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run a migration and its validator using one read/write transaction.
 *
 * Production runs migrations inside the IndexedDB versionchange transaction.
 * This helper uses a normal transaction to unit-test migration logic.
 */
export async function runMigrationForTest(
  // Database containing the test migration data.
  db: IDBDatabase,
  // Object stores used by the migration.
  storeNames: string[],
  // Migration function being tested.
  migrationFunction: TileDbMigrationFunction,
  // Validation function for the target migration version.
  validateFunction: TileDbMigrationFunction
): Promise<void> {
  const transaction = db.transaction(storeNames, 'readwrite');
  const completion = transactionAsPromise(transaction);

  const migrationContext = {db, transaction};
  await migrationFunction(migrationContext);
  await validateFunction(migrationContext);

  // Wait for all migration and validation requests to finish.
  await completion;
}
