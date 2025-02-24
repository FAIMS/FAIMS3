import {ProjectDataObject} from '@faims3/data-model';

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
  closeAndRemoveLocalDatabase(id: string): void {
    const db = this.localDatabases.get(id);
    if (db) {
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
  registerLocalDatabase(id: string, db: PouchDB.Database<ProjectDataObject>) {
    if (this.localDatabases.has(id)) {
      throw Error('Cannot register database with non-unique key! ' + id);
    }
    return this.localDatabases.set(id, db);
  }
  registerRemoteDatabase(id: string, db: PouchDB.Database<ProjectDataObject>) {
    if (this.remoteDatabases.has(id)) {
      throw Error('Cannot register database with non-unique key! ' + id);
    }
    return this.remoteDatabases.set(id, db);
  }
  registerSync(id: string, sync: PouchDB.Replication.Sync<ProjectDataObject>) {
    if (this.databaseSyncs.has(id)) {
      throw Error('Cannot register database sync with non-unique key! ' + id);
    }
    return this.databaseSyncs.set(id, sync);
  }
}

export const databaseService = DatabaseService.getInstance();
