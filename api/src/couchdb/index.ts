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
  initMetadataDB,
  initMigrationsDB,
  initPeopleDB,
  initProjectsDB,
  initTeamsDB,
  initTemplatesDB,
  InvitesDB,
  migrateDbs,
  MigrationsDB,
  PeopleDB,
  PeopleDBFields,
  PossibleConnectionInfo,
  ProjectDataObject,
  ProjectDocument,
  ProjectID,
  ProjectMetaObject,
  TeamsDB,
  TemplateDB,
} from '@faims3/data-model';
import {initialiseJWTKey} from '../auth/keySigning/initJWTKeys';
import {
  CONDUCTOR_DESCRIPTION,
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  COUCHDB_INTERNAL_URL,
  LOCAL_COUCHDB_AUTH,
} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {getAllProjectsDirectory} from './notebooks';
import {registerAdminUser} from './users';

const DIRECTORY_DB_NAME = 'directory';
const PROJECTS_DB_NAME = 'projects';
const TEMPLATES_DB_NAME = 'templates';
const AUTH_DB_NAME = 'auth';
const PEOPLE_DB_NAME = 'people';
const MIGRATIONS_DB_NAME = 'migrations';
const INVITE_DB_NAME = 'invites';
const TEAMS_DB_NAME = 'teams';

let _directoryDB: DatabaseInterface | undefined;
let _projectsDB: DatabaseInterface<ProjectDocument> | undefined;
let _templatesDb: TemplateDB | undefined;
let _authDB: AuthDatabase | undefined;
let _usersDB: PeopleDB | undefined;
let _invitesDB: InvitesDB | undefined;
let _teamsDB: TeamsDB | undefined;
let _migrationsDB: MigrationsDB | undefined;

const pouchOptions = () => {
  const options: PouchDB.Configuration.RemoteDatabaseConfiguration = {};

  if (process.env.NODE_ENV === 'test') {
    options.adapter = 'memory';
  }

  if (LOCAL_COUCHDB_AUTH !== undefined) {
    options.auth = LOCAL_COUCHDB_AUTH;
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
  const url = COUCHDB_INTERNAL_URL;

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
    const dbName = COUCHDB_INTERNAL_URL + '/' + db;
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

    const directorydb = COUCHDB_INTERNAL_URL + '/' + DIRECTORY_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + AUTH_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + PEOPLE_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + PROJECTS_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + TEMPLATES_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + MIGRATIONS_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + INVITE_DB_NAME;
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
    const dbName = COUCHDB_INTERNAL_URL + '/' + TEAMS_DB_NAME;
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
/**
 * Returns the metadata DB for a given project - involves fetching the project
 * doc and then fetching the corresponding metadata db
 * @param projectID The project Id to use
 * @returns The metadata DB for this project
 */
export const getMetadataDb = async (
  projectID: ProjectID
): Promise<DatabaseInterface<ProjectMetaObject>> => {
  // Gets the projects DB
  const projectsDB = localGetProjectsDb();
  if (!projectsDB) {
    throw new Exceptions.InternalSystemError(
      'Could not fetch the projects DB. Contact system administrator.'
    );
  }

  // Get the project doc for the given ID
  const projectDoc = await projectsDB.get(projectID);

  // 404 if project doc not found
  if (!projectDoc) {
    throw new Exceptions.ItemNotFoundException(
      'Cannot find the given project ID in the projects database.'
    );
  }

  // Now get the metadata DB from the project document (and be backwards
  // compatible)
  let db: PossibleConnectionInfo;
  db = projectDoc.metadataDb;
  if (!db) {
    const doc = projectDoc as any;
    db = doc.metadata_db;
    if (!db) {
      throw new Exceptions.InternalSystemError(
        "The given project document does not contain a mandatory reference to it's metadata database. Unsure how to fetch metadata DB. Aborting."
      );
    }
  }

  // Build the pouch connection for this DB
  const dbUrl = COUCHDB_INTERNAL_URL + '/' + db.db_name;
  const pouch_options = pouchOptions();

  // Authorise against this DB
  if (LOCAL_COUCHDB_AUTH !== undefined) {
    pouch_options.auth = LOCAL_COUCHDB_AUTH;
  }

  return new PouchDB(dbUrl, pouch_options);
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
  const dbUrl = COUCHDB_INTERNAL_URL + '/' + db.db_name;
  const pouch_options = pouchOptions();
  // Authorize against this DB
  if (LOCAL_COUCHDB_AUTH !== undefined) {
    pouch_options.auth = LOCAL_COUCHDB_AUTH;
  }
  return new PouchDB(dbUrl, pouch_options);
};

/**
 * Initialises the database level configuration for a project's metadata DB. Can
 * create the DB if it doesn't already exist.
 */
export const initialiseMetadataDb = async ({
  projectId,
  force = false,
}: {
  projectId: string;
  force?: boolean;
}): Promise<DatabaseInterface<ProjectMetaObject>> => {
  // Are we in a testing environment?
  const isTesting = process.env.NODE_ENV === 'test';

  // Get the metadata DB
  const metaDb = await getMetadataDb(projectId);

  try {
    await couchInitialiser({
      db: metaDb,
      content: initMetadataDB({projectId}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      `An error occurred while initialising the metadata DB for project ${projectId}!... ${e}`
    );
  }

  return metaDb;
};

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

  // Get the metadata DB
  const dataDb = await getDataDb(projectId);

  try {
    await couchInitialiser({
      db: dataDb,
      content: initDataDB({projectId}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      `An error occurred while initialising the data DB for project ${projectId}!... ${e}`
    );
  }

  return dataDb;
};

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

  // Establish databases (this either fetches or creates)
  // Auth
  const authDB = getAuthDB();

  // Directory
  const directoryDB = getDirectoryDB();

  // Projects
  const projectsDB = localGetProjectsDb();

  // Invites
  const invitesDB = getInvitesDB();

  // Teams
  const teamsDB = getTeamsDB();

  // Templates
  const templatesDb = getTemplatesDb();

  // Users
  const peopleDb = getUsersDB();

  // Migrations DB
  const migrationsDb = getMigrationDb();

  // Now for each, generate their initialisation documents and apply

  // Auth DB
  try {
    await couchInitialiser({
      db: authDB,
      content: initAuthDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the auth database!...' + e
    );
  }

  // Directory DB (include default document which establishes identity of this
  // conductor)
  try {
    await couchInitialiser({
      db: directoryDB,
      content: initDirectoryDB({
        defaultConfig: {
          conductorInstanceName: CONDUCTOR_INSTANCE_NAME,
          conductorUrl: CONDUCTOR_PUBLIC_URL,
          description: CONDUCTOR_DESCRIPTION,
          peopleDbName: PEOPLE_DB_NAME,
          projectsDbName: PROJECTS_DB_NAME,
        },
      }),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the directory database!...' + e
    );
  }

  // Projects DB
  try {
    await couchInitialiser({
      db: projectsDB,
      content: initProjectsDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the projects database!...' + e
    );
  }

  // Templates DB
  try {
    await couchInitialiser({
      db: templatesDb,
      content: initTemplatesDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the templates database!...' + e
    );
  }

  // People DB
  try {
    await couchInitialiser({
      db: peopleDb,
      content: initPeopleDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the people database!...' + e
    );
  }

  // Invites DB
  try {
    await couchInitialiser({
      db: invitesDB,
      content: initInvitesDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the invites database!...' + e
    );
  }

  // Teams DB
  try {
    await couchInitialiser({
      db: teamsDB,
      content: initTeamsDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the teams database!...' + e
    );
  }

  // Migrations DB
  try {
    await couchInitialiser({
      db: migrationsDb,
      content: initMigrationsDB({}),
      config: {applyPermissions: !isTesting, forceWrite: force},
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while initialising the migrations database!...' + e
    );
  }

  // For each project, ensure the metadata and data DBs are also
  // initialised/synced
  const projects = await getAllProjectsDirectory();

  for (const project of projects) {
    // Project ID
    const projectId = project._id;

    // Now initialise the DBs (potentially updating security documents etc)
    await initialiseMetadataDb({projectId, force});
    await initialiseDataDb({projectId, force});
  }

  if (pushKeys) {
    // Setup keys
    try {
      await initialiseJWTKey();
    } catch (error) {
      console.log(
        'something wrong PUTing jwt_keys into the db configuration...',
        error
      );
      throw error;
    }
  } else {
    console.log('Not pushing key configuration.');
  }
};

/**
 * Initialises and then migrates all databases!
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
    {db: getInvitesDB(), dbType: DatabaseType.INVITES, dbName: INVITE_DB_NAME},
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
  ];

  // Migrate these first
  const migrationsDb = getMigrationDb();
  await migrateDbs({dbs, migrationDb: migrationsDb, userId: 'system'});

  // Now migrate all data/metadata DBs
  const projects = await getAllProjectsDirectory();
  dbs = [];

  for (const project of projects) {
    // Project ID
    const projectId = project._id;
    const dataDb = (await getDataDb(projectId)) as DatabaseInterface;
    const metadataDb = (await getMetadataDb(projectId)) as DatabaseInterface;
    dbs.concat([
      {
        db: dataDb,
        dbType: DatabaseType.DATA,
        dbName: dataDb.name,
      },
      {
        db: metadataDb,
        dbType: DatabaseType.METADATA,
        dbName: metadataDb.name,
      },
    ]);
  }
  await migrateDbs({dbs, migrationDb: migrationsDb, userId: 'system'});

  // For users, we also establish an admin user, if not already present
  // do this after all migrations so we know the db is up to date
  await registerAdminUser();
};
