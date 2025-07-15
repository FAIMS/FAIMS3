/**
 * This is a singleton static class database service which manages a mapping of
 * IDs -> databases and sync objects. These cannot be serialised in the Redux
 * store safely, so are re-instantiated on boot and maintained while the app is
 * active.
 *
 * This class also contains a static reference to the draft DB.
 */

import {logError, ProjectDataObject} from '@faims3/data-model';
import {DraftDB} from '../../../sync/draft-storage';
import {LOCAL_POUCH_OPTIONS} from './databaseHelpers';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

export interface RegisterDbOptions {
  // Tolerant = true will disable errors when you are trying to create a
  // database with the same ID as existing
  tolerant?: boolean;
}

// Singleton service to manage database instances
class DatabaseService {
  private static instance: DatabaseService;
  // track databases that we're in the process of closing down
  private cleanupInProgress: Set<string> = new Set();
  private localDatabases: Map<string, PouchDB.Database<ProjectDataObject>> =
    new Map();
  private databaseSyncs: Map<
    string,
    PouchDB.Replication.Sync<ProjectDataObject>
  > = new Map();
  private remoteDatabases: Map<string, PouchDB.Database<ProjectDataObject>> =
    new Map();
  private draftDb: DraftDB = new PouchDB('draft-storage', LOCAL_POUCH_OPTIONS);
  private localStateDb = new PouchDB('local_state', LOCAL_POUCH_OPTIONS);

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Create or get existing database instance
  getLocalDatabase(id: string) {
    return this.localDatabases.get(id);
  }
  getRemoteDatabase(id: string) {
    return this.remoteDatabases.get(id);
  }
  getSync(id: string) {
    return this.databaseSyncs.get(id);
  }

  // Clean up database instances
  async closeAndRemoveLocalDatabase(
    id: string,
    // Clean will also remove entries/fully destroy
    {clean = false}: {clean?: boolean} = {}
  ): Promise<void> {
    if (this.cleanupInProgress.has(id)) {
      console.warn(`Cleanup already in progress for database ${id}`);
      return;
    }
    this.cleanupInProgress.add(id);

    const db = this.localDatabases.get(id);
    if (db) {
      try {
        if (clean) {
          await db.destroy();
        }
        await db.close();
      } catch (e) {
        logError(`Error closing database ${id}: ${e}`);
      } finally {
        this.localDatabases.delete(id);
      }
    }
    this.cleanupInProgress.delete(id);
  }
  async closeAndRemoveRemoteDatabase(id: string): Promise<void> {
    const db = this.remoteDatabases.get(id);
    if (db) {
      try {
        await db.close();
      } catch (e) {
        logError(`Error closing remote database ${id}: ${e}`);
      } finally {
        this.remoteDatabases.delete(id);
      }
    }
  }
  async closeAndRemoveSync(id: string): Promise<void> {
    const sync = this.databaseSyncs.get(id);
    if (sync) {
      try {
        // Remove all listeners
        sync.removeAllListeners();
        // Cancel the connection
        await sync.cancel();
      } catch (e) {
        logError(`Error closing sync ${id}: ${e}`);
      } finally {
        this.databaseSyncs.delete(id);
      }
    }
  }

  // Create or get existing database instance
  async registerLocalDatabase(
    id: string,
    db: PouchDB.Database<ProjectDataObject>,
    {tolerant = false}: RegisterDbOptions = {}
  ) {
    if (this.localDatabases.has(id)) {
      if (tolerant) {
        await this.closeAndRemoveLocalDatabase(id);
        console.warn(
          'Tolerant re-creation of existing DB closes the previous and updates with new.'
        );
      } else {
        throw Error('Cannot register database with non-unique key! ' + id);
      }
    }
    this.localDatabases.set(id, db);
  }
  async registerRemoteDatabase(
    id: string,
    db: PouchDB.Database<ProjectDataObject>,
    {tolerant = true}: RegisterDbOptions = {}
  ) {
    if (this.remoteDatabases.has(id)) {
      if (tolerant) {
        await this.closeAndRemoveRemoteDatabase(id);
        console.warn(
          'Tolerant re-creation of existing DB closes the previous and updates with new.'
        );
      } else {
        throw Error('Cannot register database with non-unique key! ' + id);
      }
    }
    this.remoteDatabases.set(id, db);
  }
  async registerSync(
    id: string,
    sync: PouchDB.Replication.Sync<ProjectDataObject>,
    {tolerant = true}: RegisterDbOptions = {}
  ) {
    if (this.databaseSyncs.has(id)) {
      if (tolerant) {
        await this.closeAndRemoveSync(id);
        console.warn(
          'Tolerant re-creation of existing sync closes the previous and updates with new.'
        );
      } else {
        throw Error('Cannot register sync with non-unique key! ' + id);
      }
    }
    this.databaseSyncs.set(id, sync);
  }

  getDraftDatabase() {
    return this.draftDb;
  }

  getLocalStateDatabase() {
    return this.localStateDb;
  }
}

export const databaseService = DatabaseService.getInstance();
