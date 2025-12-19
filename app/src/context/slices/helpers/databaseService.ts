/**
 * This is a singleton static class database service which manages a mapping of
 * IDs -> databases and sync objects. These cannot be serialised in the Redux
 * store safely, so are re-instantiated on boot and maintained while the app is
 * active.
 *
 */

import {logError, ProjectDataObject} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import {createLocalPouchDatabase} from './databaseHelpers';
import {PouchDBWrapper} from './pouchDBWrapper';
PouchDB.plugin(PouchDBFind);

// Local State db can contain two types of document that don't have a
// field we can use for a discriminator, so we use 'any' for the type
// when making the database and relay on local checks
export type LocalStateDbType = any;
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
  private localDatabases: Map<string, PouchDBWrapper<ProjectDataObject>> =
    new Map();
  private databaseSyncs: Map<
    string,
    PouchDB.Replication.Sync<ProjectDataObject>
  > = new Map();
  // remote databases are not wrapped
  private remoteDatabases: Map<string, PouchDB.Database<ProjectDataObject>> =
    new Map();
  private localStateDb: PouchDBWrapper<LocalStateDbType>;

  private constructor() {
    this.localStateDb = this.createLocalStateDb();
  }

  createLocalStateDb() {
    return new PouchDBWrapper<LocalStateDbType>('local_state');
  }

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

  // Remove a local database, destroying all content
  // note that we don't use this yet, we don't have a good way to ensure
  // that all data is synced before deleting
  async destroyLocalDatabase(id: string): Promise<void> {
    const db = this.localDatabases.get(id);
    if (db) {
      try {
        await db.destroy();
      } catch (e) {
        logError(`Error destroying database ${id}: ${e}`);
      } finally {
        this.localDatabases.delete(id);
      }
    }
  }

  // Clean up database instances
  async closeAndRemoveLocalDatabase(id: string): Promise<void> {
    if (this.cleanupInProgress.has(id)) {
      console.warn(`Cleanup already in progress for database ${id}`);
      return;
    }
    this.cleanupInProgress.add(id);

    const db = this.localDatabases.get(id);
    if (db) {
      try {
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
    db: PouchDBWrapper<ProjectDataObject>,
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

  getLocalStateDatabase() {
    return this.localStateDb;
  }

  // method for ensuring that all database connections are valid
  // and working.  Mitigates a bug (possibly only on IOS) where
  // the IDB database connection becomes invalid and so all
  // database operations fail.
  // Here we look at all local database connections, check that
  // we can read from them, and if not we close and re-open
  // the database connection.
  async validateLocalDatabases() {
    let repairCount = 0;
    for (const [id, db] of this.localDatabases) {
      try {
        // try a simple read operation
        await db.info();
      } catch (e) {
        logError(`Database ${id} appears invalid, re-opening: ${e}`);
        // re-open the database connection
        const newDb = createLocalPouchDatabase<ProjectDataObject>({id});
        // can't use registerLocalDatabase as that complains if we already know this db
        // so just replace the existing entry
        this.localDatabases.set(id, newDb);
        repairCount += 1;
      }
    }

    try {
      if (this.localStateDb) {
        await this.localStateDb.info();
      } else {
        logError('Local state database missing, re-opening');
        this.localStateDb = this.createLocalStateDb();
        repairCount += 1;
      }
    } catch (e) {
      logError(`Local state database appears invalid, re-opening: ${e}`);
      this.localStateDb = this.createLocalStateDb();
      repairCount += 1;
    }
    return repairCount;
  }

  // for debugging - damage all local dbs by closing them but leaving the handle
  // in the databases list
  async damage() {
    console.log('Damaging all local databases for testing');
    for (const id of this.localDatabases.keys()) {
      await this.localDatabases.get(id)?.close();
    }
  }
}

export const databaseService = DatabaseService.getInstance();
