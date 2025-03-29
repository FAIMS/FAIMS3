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
 * Description:
 *   Implements a class to manage databases in IndexedDB
 */

type KeyType = string | string[] | null | undefined;

/**
 * IDBObjectStore class provides a simpler interface to storing and retrieving
 * data from an IndexedDB ObjectStore.  It doesn't manage the IDB connection
 * itself.
 */
export class IDBObjectStore<Type> {
  keyPath: KeyType;
  db: any;
  dbName: string;

  constructor(db: any, dbName: string, keyPath: KeyType) {
    this.keyPath = keyPath;
    this.db = db;
    this.dbName = dbName;
  }

  // Create the object store for this database, called in
  // onupgradeneeded for the database
  createObjectStore() {
    if (!this.db.objectStoreNames.contains(this.dbName)) {
      this.db.createObjectStore(this.dbName, {
        keyPath: this.keyPath,
      });
    }
  }

  async get(query: IDBKeyRange | IDBValidKey): Promise<Type | undefined> {
    return new Promise<Type | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readonly');
      const store = transaction.objectStore(this.dbName);
      const request = store.get(query);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Type[] | undefined> {
    return new Promise<Type[] | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readonly');
      const store = transaction.objectStore(this.dbName);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async put(object: Type) {
    return new Promise<IDBValidKey | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readwrite');
      const store = transaction.objectStore(this.dbName);
      const request = store.put(object);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: IDBValidKey) {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readwrite');
      const store = transaction.objectStore(this.dbName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    if (this.db) {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db.transaction(this.dbName, 'readwrite');
        const store = transaction.objectStore(this.dbName);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        store.clear();
      });
    }
  }
}
