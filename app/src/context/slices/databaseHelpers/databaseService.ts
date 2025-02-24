import PouchDB from 'pouchdb';
import {  ProjectIdentity } from '../projectSlice';
import { ProjectDataObject } from '@faims3/data-model';

// Singleton service to manage database instances
class DatabaseService {
  private static instance: DatabaseService;
  private databaseInstances: Map<string, PouchDB.Database<ProjectDataObject>> = new Map();
  
  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Generate a consistent key for storing/retrieving database instances
  private getDatabaseKey(identity: ProjectIdentity): string {
    return `${identity.serverId}:${identity.projectId}`;
  }

  // Create or get existing database instance
  getDatabase(identity: ProjectIdentity): PouchDB.Database<ProjectDataObject> {
    const key = this.getDatabaseKey(identity);
    
    if (!this.databaseInstances.has(key)) {
      const db = new PouchDB<ProjectDataObject>(key);
      this.databaseInstances.set(key, db);
    }
    
    return this.databaseInstances.get(key)!;
  }

  // Clean up database instance
  removeDatabase(identity: ProjectIdentity): void {
    const key = this.getDatabaseKey(identity);
    const db = this.databaseInstances.get(key);
    if (db) {
      db.close();
      this.databaseInstances.delete(key);
    }
  }

  // Get sync status
  getSyncStatus(identity: ProjectIdentity): boolean {
    const key = this.getDatabaseKey(identity);
    return this.databaseInstances.has(key);
  }
}

export const databaseService = DatabaseService.getInstance();

// projectSlice.ts - Modified reducer
interface ProjectState {
  isActivated: boolean;
  isSyncing: boolean;
  // Remove database instance references, just store configuration
  config: {
    projectId: string;
    serverId: string;
    syncConfig?: {
      remote: string;
      credentials: string;
    };
  };
}

// Example of using in a component
const ProjectComponent: React.FC<ProjectIdentity> = ({ serverId, projectId }) => {
  const dispatch = useAppDispatch();
  const projectConfig = useAppSelector(state => 
    selectProjectConfig({ serverId, projectId })
  );

  useEffect(() => {
    if (projectConfig.isActivated) {
      // Get database instance from service when needed
      const db = databaseService.getDatabase({ serverId, projectId });
      
      // Use database instance...
      db.changes({
        since: 'now',
        live: true
      }).on('change', (change) => {
        // Handle changes
      });
    }
  }, [projectConfig.isActivated]);

  return <div>{/* Component JSX */}</div>;
};