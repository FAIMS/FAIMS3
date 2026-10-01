// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: index.ts
 * Description:
 *    Core functions to access the various databases used by the application
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import {
  AuthDatabase,
  couchInitialiser,
  DATABASE_TYPE,
  DatabaseInterface,
  DatabaseType,
  initAuthDB,
  initDataDB,
  initDirectoryDB,
  initInvitesDB,
  initMigrationsDB,
  initPeopleDB,
  initProjectsDB,
  initTeamsDB,
  initTemplatesDB,
  initTombstoneDB,
  InvitesDB,
  GetDbById,
  collectProjectDataDbs,
  dataDbNameForProject,
  migrateDbs,
  ProjectDataDbRef,
  registerDbAtCurrentVersion,
  unregisterDbMigrationDoc,
  MigrationsDB,
  PeopleDB,
  PeopleDBFields,
  PossibleConnectionInfo,
  ProjectDataObject,
  ProjectDocument,
  ProjectID,
  TeamsDB,
  TemplateDB,
  TombstoneDB,
} from '@faims3/data-model';
import Nano from 'nano';
import {initialiseJWTKey} from '../auth/keySigning/initJWTKeys';
import {config} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {getAllProjectsListing} from './notebooks';
import {registerAdminUser} from './users';

const DIRECTORY_DB_NAME = 'directory';
const PROJECTS_DB_NAME = 'projects';
const TEMPLATES_DB_NAME = 'templates';
const AUTH_DB_NAME = 'auth';
const PEOPLE_DB_NAME = 'people';
const MIGRATIONS_DB_NAME = 'migrations';
const INVITE_DB_NAME = 'invites';
const TEAMS_DB_NAME = 'teams';
const TOMBSTONE_DB_NAME = 'tombstone';

let _directoryDB: DatabaseInterface | undefined;
let _projectsDB: DatabaseInterface<ProjectDocument> | undefined;
let _templatesDb: TemplateDB | undefined;
let _authDB: AuthDatabase | undefined;
let _usersDB: PeopleDB | undefined;
let _invitesDB: InvitesDB | undefined;
let _teamsDB: TeamsDB | undefined;
let _tombstoneDB: TombstoneDB | undefined;
let _migrationsDB: MigrationsDB | undefined;

const pouchOptions = () => {
  const options: PouchDB.Configuration.RemoteDatabaseConfiguration = {};

  if (process.env.NODE_ENV === 'test') {
    options.adapter = 'memory';
  }

  if (config.localCouchdbAuth !== undefined) {
    options.auth = config.localCouchdbAuth;
  }
  return options;
};

export type CouchDBConnectionResult = {
  valid: boolean;
  server_msg?: string;
  database_errors?: string[];
  validate_error?: string;
};

export const databaseValidityReport: CouchDBConnectionResult = {
  valid: true,
  server_msg: '',
  database_errors: [],
  validate_error: '',
};

export const verifyCouchDBConnection = async () => {
  const result = databaseValidityReport;
  const url = config.couchdbInternalUrl;

  // can we reach the couchdb server?
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => {
    console.log('Catching error');
    return null;
  });

  if (!response) {
    result.valid = false;
    result.server_msg = `Unable to connect to CouchDB server at ${url}`;
    return result;
  }

  // reset valid to true here, will set to falsel below if something is missing
  result.valid = true;

  // now we know we can connect to the server, but can we connect to the database?
  const pouch_options = pouchOptions();
  // don't create databases if they don't exist
  pouch_options.skip_setup = true;

  // check for all required databases
  const required = ['people', 'projects', 'templates', 'auth'];

  for (let i = 0; i < required.length; i++) {
    const db = required[i];
    const dbName = config.couchdbInternalUrl + '/' + db;
    try {
      const dbInstance = new PouchDB(dbName, pouch_options);
      const info = (await dbInstance.info()) as any; // type does not include error
      if (info.error === 'not_found') {
        result.valid = false;
        result.database_errors?.push(`Database ${db} not found`);
      }
    } catch {
      result.valid = false;
      result.database_errors?.push(
        `Unable to connect to CouchDB database ${db}`
      );
    }
  }

  return result;
};

export const getDirectoryDB = (): DatabaseInterface => {
  if (!_directoryDB) {
    const pouch_options = pouchOptions();

    const directorydb = config.couchdbInternalUrl + '/' + DIRECTORY_DB_NAME;
    try {
      _directoryDB = new PouchDB(directorydb, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting directory database.'
      );
    }
  }
  return _directoryDB;
};

export const getAuthDB = (): AuthDatabase => {
  if (!_authDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + AUTH_DB_NAME;
    try {
      _authDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting auth database.'
      );
    }
  }
  return _authDB;
};

export const getUsersDB = (): PeopleDB => {
  if (!_usersDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + PEOPLE_DB_NAME;
    try {
      _usersDB = new PouchDB<PeopleDBFields>(dbName, pouch_options);
    } catch {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting users database.'
      );
    }
  }

  return _usersDB;
};

export const localGetProjectsDb = (): DatabaseInterface<ProjectDocument> => {
  if (!_projectsDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + PROJECTS_DB_NAME;
    try {
      _projectsDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting projects database.'
      );
    }
  }
  return _projectsDB;
};

export const getTemplatesDb = (): TemplateDB => {
  if (!_templatesDb) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + TEMPLATES_DB_NAME;
    try {
      _templatesDb = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting templates database.'
      );
    }
  }
  return _templatesDb;
};

export const getMigrationDb = (): MigrationsDB => {
  if (!_migrationsDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + MIGRATIONS_DB_NAME;
    try {
      _migrationsDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting migrations database.'
      );
    }
  }
  return _migrationsDB;
};

export const getInvitesDB = (): DatabaseInterface => {
  if (!_invitesDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + INVITE_DB_NAME;
    try {
      _invitesDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting invites database.'
      );
    }
  }
  return _invitesDB;
};

export const getTeamsDB = (): TeamsDB => {
  if (!_teamsDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + TEAMS_DB_NAME;
    try {
      _teamsDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting teams database.'
      );
    }
  }
  return _teamsDB;
};

export const getTombstoneDB = (): TombstoneDB => {
  if (!_tombstoneDB) {
    const pouch_options = pouchOptions();
    const dbName = config.couchdbInternalUrl + '/' + TOMBSTONE_DB_NAME;
    try {
      _tombstoneDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting tombstone database.'
      );
    }
  }
  return _tombstoneDB;
};

/**
 * Returns the data DB for a given project - involves fetching the project
 * doc and then fetching the corresponding data db
 * @param projectID The project ID to use
 * @returns The data DB for this project or undefined if not found
 */
export const getDataDb = async (
  projectID: ProjectID
): Promise<DatabaseInterface<ProjectDataObject>> => {
  // Get the projects DB
  const projectsDB = localGetProjectsDb();
  if (!projectsDB) {
    throw new Exceptions.InternalSystemError(
      'Could not fetch the projects DB. Contact system administrator.'
    );
  }

  // Get the project doc for the given ID
  const projectDoc = await projectsDB.get(projectID);
  if (!projectDoc) {
    throw new Exceptions.ItemNotFoundException(
      'Cannot find the given project ID in the projects database.'
    );
  }

  // Now get the metadata DB from the project document (and be backwards
  // compatible)
  let db: PossibleConnectionInfo;
  db = projectDoc.dataDb;
  if (!db) {
    const doc = projectDoc as any;
    db = doc.data_db;
    if (!db) {
      throw new Exceptions.InternalSystemError(
        "The given project document does not contain a mandatory reference to it's data database. Unsure how to fetch data DB. Aborting."
      );
    }
  }

  // Build the pouch connection for this DB
  const dbUrl = config.couchdbInternalUrl + '/' + db.db_name;
  const pouch_options = pouchOptions();
  // Authorize against this DB
  if (config.localCouchdbAuth !== undefined) {
    pouch_options.auth = config.localCouchdbAuth;
  }
  return new PouchDB(dbUrl, pouch_options);
};

const openCouchDatabaseByName = (dbName: string): DatabaseInterface => {
  const pouch_options = pouchOptions();
  const dbUrl = config.couchdbInternalUrl + '/' + dbName;
  if (config.localCouchdbAuth !== undefined) {
    pouch_options.auth = config.localCouchdbAuth;
  }
  return new PouchDB(dbUrl, pouch_options);
};

/**
 * Opens an authenticated CouchDB handle for migrations and other server-side
 * callers.
 *
 * - With {@link dbType}: {@link id} is interpreted per kind (e.g. project id for DATA).
 * - Without {@link dbType}: {@link id} is the Couch database name to open directly.
 */
export const getDbById: GetDbById = async ({dbType, id}) => {
  if (dbType === undefined) {
    return openCouchDatabaseByName(id);
  }

  switch (dbType) {
    case DatabaseType.AUTH:
      return getAuthDB();
    case DatabaseType.DATA:
      return getDataDb(id as ProjectID);
    case DatabaseType.DIRECTORY:
      return getDirectoryDB();
    case DatabaseType.INVITES:
      return getInvitesDB();
    case DatabaseType.PEOPLE:
      return getUsersDB();
    case DatabaseType.PROJECTS:
      return localGetProjectsDb();
    case DatabaseType.TEMPLATES:
      return getTemplatesDb();
    case DatabaseType.TEAMS:
      return getTeamsDB();
    case DatabaseType.TOMBSTONE:
      return getTombstoneDB();
    default: {
      const _exhaustive: never = dbType;
      throw new Exceptions.InternalSystemError(
        `Unsupported database type for getDbById: ${_exhaustive}`
      );
    }
  }
};

const DB_INIT_LOG = '[db-initialisation]';

/**
 * Initialises the database level configuration for a project's data DB. Can
 * create the DB if it doesn't already exist.
 */
export const initialiseDataDb = async ({
  projectId,
  force = false,
}: {
  projectId: string;
  force?: boolean;
}): Promise<DatabaseInterface<ProjectDataObject>> => {
  // Are we in a testing environment?
  const isTesting = process.env.NODE_ENV === 'test';

  console.log(
    `${DB_INIT_LOG} Initialising data DB for project ${projectId} (force=${force})`
  );

  // Get the metadata DB
  const dataDb = await getDataDb(projectId);

  try {
    await couchInitialiser({
      db: dataDb,
      content: initDataDB({projectId}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    console.error(
      `${DB_INIT_LOG} Failed to initialise data DB for project ${projectId}`,
      e
    );
    throw new Exceptions.InternalSystemError(
      `An error occurred while initialising the data DB for project ${projectId}!... ${e}`
    );
  }

  return dataDb;
};

const dataDbNameForProjectRef = (project: ProjectDataDbRef): string =>
  dataDbNameForProject({
    project,
    fallbackName: `data-${project._id}`,
  });

/**
 * Records a newly created project data DB as already at the current schema
 * version. Must only be called on true create paths — not restore or startup
 * re-init, which may load legacy documents afterwards.
 */
export const registerDataDbAtCurrentVersion = async ({
  project,
  launchedBy = 'system',
}: {
  project: ProjectDataDbRef;
  launchedBy?: string;
}) =>
  registerDbAtCurrentVersion({
    dbType: DatabaseType.DATA,
    dbName: dataDbNameForProjectRef(project),
    migrationDb: getMigrationDb(),
    launchedBy,
  });

/**
 * Drops the migration document for a project data DB that has been deleted.
 */
export const unregisterDataDbMigration = async ({
  project,
}: {
  project: ProjectDataDbRef;
}) =>
  unregisterDbMigrationDoc({
    dbType: DatabaseType.DATA,
    dbName: dataDbNameForProjectRef(project),
    migrationDb: getMigrationDb(),
  });

/**
 * Critical method which initialises all databases, including remotely on the
 * configured couch instance.
 *
 * This systematically generates a set of initialisation content from the data
 * model, then applies this initialisation using a helper method in the data
 * model.
 *
 * Some local information is injected as part of the config generation step -
 * e.g. conductor name/description.
 *
 * Also initialises keys based on the configured key service.
 *
 * If force = true, documents will always be written, even if it already exists.
 *
 * If pushKeys = true, will update the public keys
 *
 * @param force Write on clash
 */
export const initialiseDbAndKeys = async ({
  force = false,
  pushKeys = true,
}: {
  force?: boolean;
  // Should we push the key configuration?
  pushKeys?: boolean;
}) => {
  // Are we in a testing environment?
  const isTesting = process.env.NODE_ENV === 'test';

  console.log(`${DB_INIT_LOG} Starting (force=${force}, pushKeys=${pushKeys})`);

  // Directory DB includes a default document which establishes identity of
  // this conductor
  const globalDbs: {
    dbName: string;
    db: DatabaseInterface;
    content: ReturnType<typeof initAuthDB>;
  }[] = [
    {dbName: AUTH_DB_NAME, db: getAuthDB(), content: initAuthDB({})},
    {
      dbName: DIRECTORY_DB_NAME,
      db: getDirectoryDB(),
      content: initDirectoryDB({
        defaultConfig: {
          conductorInstanceName: config.conductorInstanceName,
          conductorUrl: config.conductorPublicUrl,
          description: config.instanceDescription,
          peopleDbName: PEOPLE_DB_NAME,
          projectsDbName: PROJECTS_DB_NAME,
        },
      }),
    },
    {
      dbName: PROJECTS_DB_NAME,
      db: localGetProjectsDb(),
      content: initProjectsDB({}),
    },
    {
      dbName: TEMPLATES_DB_NAME,
      db: getTemplatesDb(),
      content: initTemplatesDB({}),
    },
    {dbName: PEOPLE_DB_NAME, db: getUsersDB(), content: initPeopleDB({})},
    {dbName: INVITE_DB_NAME, db: getInvitesDB(), content: initInvitesDB({})},
    {dbName: TEAMS_DB_NAME, db: getTeamsDB(), content: initTeamsDB({})},
    {
      dbName: TOMBSTONE_DB_NAME,
      db: getTombstoneDB(),
      content: initTombstoneDB({}),
    },
    {
      dbName: MIGRATIONS_DB_NAME,
      db: getMigrationDb(),
      content: initMigrationsDB({}),
    },
  ];

  console.log(
    `${DB_INIT_LOG} Initialising ${globalDbs.length} global DB(s): ${globalDbs
      .map(d => d.dbName)
      .join(', ')}`
  );

  for (const {dbName, db, content} of globalDbs) {
    const designIds = content.designDocuments.map(doc => doc._id).join(', ');
    console.log(
      `${DB_INIT_LOG} Initialising global DB ${dbName} (${content.designDocuments.length} design doc(s)${
        designIds ? `: ${designIds}` : ''
      }${content.defaultDocument ? ', default document' : ''}, force=${force})`
    );
    try {
      await couchInitialiser({
        db,
        content,
        config: {applyPermissions: !isTesting, forceWrite: force},
      });
    } catch (e) {
      console.error(
        `${DB_INIT_LOG} Failed to initialise global DB ${dbName}`,
        e
      );
      throw new Exceptions.InternalSystemError(
        `An error occurred while initialising the ${dbName} database!...` + e
      );
    }
  }

  // For each project, ensure the data DBs are also initialised/synced
  const projects = await getAllProjectsListing();
  console.log(
    `${DB_INIT_LOG} Found ${projects.length} project(s); initialising data DBs`
  );

  for (const project of projects) {
    await initialiseDataDb({projectId: project._id, force});
  }

  if (pushKeys) {
    console.log(`${DB_INIT_LOG} Pushing JWT key configuration`);
    try {
      await initialiseJWTKey();
    } catch (error) {
      console.error(
        `${DB_INIT_LOG} Failed to push JWT key configuration`,
        error
      );
      throw error;
    }
  } else {
    console.log(
      `${DB_INIT_LOG} Skipping JWT key configuration (pushKeys=false)`
    );
  }

  console.log(`${DB_INIT_LOG} Completed`);
};

/**
 * Migrate every project's data DB to the current target version.
 *
 * Used after a full stack init and after backup restore (restored record
 * documents may predate data v2 `updatedAt`).
 */
export const migrateAllProjectDataDbs = async () => {
  const projects = await getAllProjectsListing();
  console.log(
    `[migrate] Found ${projects.length} project(s); opening data DBs`
  );

  const {queued: dataDbs, skipped: skippedDataDbs} =
    await collectProjectDataDbs({
      projects,
      openDataDb: async (projectId: string) =>
        (await getDataDb(projectId)) as DatabaseInterface,
    });

  for (const {projectId, dbName} of dataDbs) {
    console.log(
      `[migrate] Queued data DB for project ${projectId} (${dbName})`
    );
  }
  for (const {projectId, error} of skippedDataDbs) {
    console.error(
      `[migrate] Failed to open data DB for project ${projectId}; skipping`,
      error
    );
  }

  if (projects.length > 0 && dataDbs.length === 0) {
    console.error(
      `[migrate] ${projects.length} project(s) found but 0 data DBs queued — data migrations will not run`
    );
  } else {
    console.log(
      `[migrate] Migrating ${dataDbs.length} data DB(s): ${
        dataDbs.map(d => d.dbName).join(', ') || '(none)'
      }`
    );
  }

  await migrateDbs({
    dbs: dataDbs,
    migrationDb: getMigrationDb(),
    userId: 'system',
    getDbById,
  });
};

/**
 * Initialises and then migrates all databases.
 *
 * Used by `pnpm migrate-with-keys` and by clustered API startup (the latter
 * serialises this call behind the startup migration lock).
 */
export const initialiseAndMigrateDBs = async ({
  force = false,
  pushKeys = true,
}: {
  force?: boolean;
  // Should we push the key configuration?
  pushKeys?: boolean;
}) => {
  await initialiseDbAndKeys({force, pushKeys});

  let dbs: {dbType: DATABASE_TYPE; dbName: string; db: DatabaseInterface}[] = [
    {db: getAuthDB(), dbType: DatabaseType.AUTH, dbName: AUTH_DB_NAME},
    {
      db: getDirectoryDB(),
      dbType: DatabaseType.DIRECTORY,
      dbName: DIRECTORY_DB_NAME,
    },
    {
      db: getInvitesDB(),
      dbType: DatabaseType.INVITES,
      dbName: INVITE_DB_NAME,
    },
    {db: getUsersDB(), dbType: DatabaseType.PEOPLE, dbName: PEOPLE_DB_NAME},
    {
      db: localGetProjectsDb(),
      dbType: DatabaseType.PROJECTS,
      dbName: PROJECTS_DB_NAME,
    },
    {
      db: getTemplatesDb(),
      dbType: DatabaseType.TEMPLATES,
      dbName: TEMPLATES_DB_NAME,
    },
    {
      db: getTombstoneDB(),
      dbType: DatabaseType.TOMBSTONE,
      dbName: TOMBSTONE_DB_NAME,
    },
  ];

  // Migrate these first
  const migrationsDb = getMigrationDb();
  console.log(
    `[migrate] Migrating ${dbs.length} global DB(s): ${dbs
      .map(d => `${d.dbType}:${d.dbName}`)
      .join(', ')}`
  );
  await migrateDbs({
    dbs,
    migrationDb: migrationsDb,
    userId: 'system',
    getDbById,
  });

  await migrateAllProjectDataDbs();

  // For users, we also establish an admin user, if not already present
  // do this after all migrations so we know the db is up to date
  await registerAdminUser();
};

// Initialize nano instance
let _nanoInstance: Nano.ServerScope | undefined;

const getNanoInstance = async (): Promise<Nano.ServerScope> => {
  if (!_nanoInstance) {
    // Create nano instance without auth in the URL
    _nanoInstance = Nano(config.couchdbInternalUrl);
  }

  // Authenticate if we have credentials - if we haven't then this isn't going to work anyway...
  // note that we do this every time even though we get a cookie and could use that
  // cookie expires every 600s so to be safe we re-authenticate each time
  if (config.localCouchdbAuth) {
    await _nanoInstance.auth(
      config.localCouchdbAuth.username,
      config.localCouchdbAuth.password
    );
  } else {
    console.error("No local CouchDB auth configured - can't talk to CouchDB!");
  }

  return _nanoInstance;
};

/** Lists all database names on the configured CouchDB server. */
export const listCouchDatabaseNames = async (): Promise<string[]> => {
  const nano = await getNanoInstance();
  return nano.db.list();
};

/** Permanently deletes a CouchDB database by name. */
export const destroyCouchDatabase = async (dbName: string): Promise<void> => {
  const nano = await getNanoInstance();
  await nano.db.destroy(dbName);
};

/** Compacts a CouchDB database by name (reclaims revision bodies). */
export const compactCouchDatabase = async (dbName: string): Promise<void> => {
  const nano = await getNanoInstance();
  await nano.db.compact(dbName);
};

/**
 * Returns the data DB for a given project using nano-couchdb
 * @param projectID The project ID to use
 * @returns The nano document scope for this project's data DB
 */
export const getNanoDataDb = async (
  projectID: ProjectID
): Promise<Nano.DocumentScope<ProjectDataObject>> => {
  const nano = await getNanoInstance();
  // Get the projects DB
  const projectsDB = nano.db.use('projects');
  try {
    // Get the project document
    const projectDoc = await projectsDB.get(projectID);
    // Extract the data DB name (with backwards compatibility)
    const db: PossibleConnectionInfo =
      (projectDoc as any).dataDb || (projectDoc as any).data_db;
    if (!db || !db.db_name) {
      throw new Exceptions.InternalSystemError(
        'The given project document does not contain a mandatory reference to its data database.'
      );
    }
    // Return the nano document scope for the data DB
    return nano.db.use<ProjectDataObject>(db.db_name);
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw new Exceptions.ItemNotFoundException(
        'Cannot find the given project ID in the projects database.'
      );
    }
    throw new Exceptions.InternalSystemError(
      `Error fetching data DB for project ${projectID}: ${error.message}`
    );
  }
};
