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
 *   Defines a wrapper around the PouchDB API so that we can catch
 * and mitigate the indexedDB failure that occurs on IOS devices
 */

/*
 * This wrapper should have the same interface as PouchDB.Database
 * so that it can be used as a drop-in replacement.  All operations
 * then go through the withRetry() method which will try to re-connect
 * to the database if one of the known errors occurs.
 *
 * This should have no performance impact apart from the additional
 * function call overhead.
 */

import {DatabaseInterface} from '@faims3/data-model';
import {RUNNING_UNDER_TEST} from '../../../buildconfig';
import {logError} from '../../../logging';
import PouchDB from 'pouchdb-browser';

// This is the PouchDB type which provides options for instantiating a database
type LocalDatabaseOptions = PouchDB.Configuration.DatabaseConfiguration;

// Default local options is none
export const LOCAL_POUCH_OPTIONS: LocalDatabaseOptions = {};

// enable memory adapter for testing
if (RUNNING_UNDER_TEST) {
  LOCAL_POUCH_OPTIONS['adapter'] = 'memory';
}

// Error types that indicate we should recreate the database connection
const RECREATION_ERROR_NAMES = [
  'InvalidStateError',
  'AbortError',
  'TransactionInactiveError',
  'NotFoundError',
  'DataError',
  'VersionError',
];

export class PouchDBWrapper<T extends {}> implements DatabaseInterface<T> {
  db: PouchDB.Database<T>;
  name: string;
  private recreationCount = 0;
  private maxRecreations = 3;

  constructor(name: string) {
    // create a new database with this name and the standard options
    this.name = name;
    this.db = new PouchDB<T>(name, LOCAL_POUCH_OPTIONS);
  }

  private shouldRecreate(error: any): boolean {
    // Check if this is an error type that indicates connection issues
    return RECREATION_ERROR_NAMES.some(
      errorName =>
        error.name === errorName || error.message?.includes(errorName)
    );
  }

  private async _recreate(): Promise<void> {
    this.recreationCount++;

    try {
      // Destroy the old database instance
      await this.db.close?.();
    } catch (e) {
      // Ignore errors when closing
    }

    // Create new instance
    this.db = new PouchDB(this.name, LOCAL_POUCH_OPTIONS);
  }

  // Execute an operation with retry on certain errors
  private async withRetry<R>(
    operation: () => Promise<R> | R,
    operationName: string
  ): Promise<R> {
    try {
      return await operation();
    } catch (error) {
      if (
        this.shouldRecreate(error) &&
        this.recreationCount < this.maxRecreations
      ) {
        logError(
          `${operationName} failed, attempting to recreate connection ${error}`
        );
        await this._recreate();

        // Reset recreation count on successful recreation
        try {
          const result = await operation();
          this.recreationCount = 0; // Reset on success
          return result;
        } catch (retryError) {
          logError(`${operationName} failed after recreation ${retryError}`);
          throw retryError;
        }
      } else {
        if (this.recreationCount >= this.maxRecreations) {
          logError(
            `${operationName} failed: maximum recreation attempts exceeded`
          );
        }
        throw error;
      }
    }
  }

  // define the main PouchDB methods we need

  async allDocs(options?: PouchDB.Core.AllDocsOptions) {
    return this.withRetry(() => this.db.allDocs(options), 'allDocs');
  }

  async bulkDocs<C>(
    docs: PouchDB.Core.PutDocument<T & C>[],
    options?: PouchDB.Core.BulkDocsOptions
  ) {
    return this.withRetry(() => this.db.bulkDocs(docs, options), 'bulkDocs');
  }

  async get<Model>(id: string, options?: any) {
    return this.withRetry(() => this.db.get<Model>(id, options), 'get');
  }

  async put<Model extends {}>(
    doc: PouchDB.Core.PutDocument<T & Model>,
    options?: any
  ) {
    if (options)
      return this.withRetry(() => this.db.put<Model>(doc, options), 'put');
    else return this.withRetry(() => this.db.put<Model>(doc), 'put');
  }

  async putAttachment(
    docId: PouchDB.Core.DocumentId,
    attachmentId: PouchDB.Core.AttachmentId,
    rev: PouchDB.Core.RevisionId,
    attachment: PouchDB.Core.AttachmentData,
    type: string
  ): Promise<PouchDB.Core.Response> {
    return this.withRetry(
      () => this.db.putAttachment(docId, attachmentId, rev, attachment, type),
      'putAttachment'
    );
  }

  async post<Model extends {}>(
    doc: PouchDB.Core.PostDocument<T & Model>,
    options?: any
  ) {
    return this.withRetry(() => this.db.post<Model>(doc, options), 'post');
  }

  async find(query: PouchDB.Find.FindRequest<T>) {
    return this.withRetry(() => this.db.find(query), 'find');
  }

  async remove(doc: any, options?: any) {
    return this.withRetry(() => this.db.remove(doc, options), 'remove');
  }

  async info() {
    return this.withRetry(() => this.db.info(), 'info');
  }

  async close() {
    return this.withRetry(() => this.db.close(), 'close');
  }

  async query<Result extends {}, Model extends {} = T>(
    fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
    opts?: PouchDB.Query.Options<Model, Result>
  ) {
    return this.withRetry(() => this.db.query(fun, opts), 'query');
  }

  // security is not implemented for local browser based databases but we need
  // to include the method to match the interface
  async security() {}

  async destroy() {
    return this.withRetry(() => this.db.destroy(), 'destroy');
  }

  // Reset recreation count manually if needed
  resetRecreationCount(): void {
    this.recreationCount = 0;
  }
}
