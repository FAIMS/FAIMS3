import {ProjectDataObject} from '@faims3/data-model';
import {DraftDB} from '../../../sync/draft-storage';
import {LOCAL_POUCH_OPTIONS} from './databaseHelpers';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

export interface RegisterDbOptions {
  tolerant?: boolean;
}

// Singleton service to manage database instances
class DatabaseService {
  private static instance: DatabaseService;
  private localDatabases: Map<string, PouchDB.Database<ProjectDataObject>> =
    new Map();
  private databaseSyncs: Map<
    string,
    PouchDB.Replication.Sync<ProjectDataObject>
  > = new Map();
  private remoteDatabases: Map<string, PouchDB.Database<ProjectDataObject>> =
    new Map();
  private draftDb: DraftDB = new PouchDB('draft-storage', LOCAL_POUCH_OPTIONS);

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
  closeAndRemoveLocalDatabase(
    id: string,
    {clean = false}: {clean?: boolean} = {}
  ): void {
    const db = this.localDatabases.get(id);
    if (db) {
      if (clean) {
        db.destroy();
      }
      db.close();
      this.localDatabases.delete(id);
    }
  }
  closeAndRemoveRemoteDatabase(id: string): void {
    const db = this.remoteDatabases.get(id);
    if (db) {
      db.close();
      this.remoteDatabases.delete(id);
    }
  }
  closeAndRemoveSync(id: string): void {
    const sync = this.databaseSyncs.get(id);
    if (sync) {
      // Remove all listeners
      sync.removeAllListeners();
      // Cancel the connection
      sync.cancel();
      this.databaseSyncs.delete(id);
    }
  }

  // Create or get existing database instance
  registerLocalDatabase(
    id: string,
    db: PouchDB.Database<ProjectDataObject>,
    {tolerant = false}: RegisterDbOptions = {}
  ) {
    if (this.localDatabases.has(id)) {
      if (tolerant) {
        this.closeAndRemoveLocalDatabase(id);
        console.warn(
          'Tolerant re-creation of existing DB closes the previous and updates with new.'
        );
      } else {
        throw Error('Cannot register database with non-unique key! ' + id);
      }
    }
    this.localDatabases.set(id, db);
  }
  registerRemoteDatabase(
    id: string,
    db: PouchDB.Database<ProjectDataObject>,
    {tolerant = true}: RegisterDbOptions = {}
  ) {
    if (this.remoteDatabases.has(id)) {
      if (tolerant) {
        this.closeAndRemoveRemoteDatabase(id);
        console.warn(
          'Tolerant re-creation of existing DB closes the previous and updates with new.'
        );
      } else {
        throw Error('Cannot register database with non-unique key! ' + id);
      }
    }
    this.remoteDatabases.set(id, db);
  }
  registerSync(
    id: string,
    sync: PouchDB.Replication.Sync<ProjectDataObject>,
    {tolerant = true}: RegisterDbOptions = {}
  ) {
    if (this.databaseSyncs.has(id)) {
      if (tolerant) {
        this.closeAndRemoveSync(id);
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
}

export const databaseService = DatabaseService.getInstance();
