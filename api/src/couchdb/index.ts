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
  initAuthDB,
  initDataDB,
  initDirectoryDB,
  initMetadataDB,
  initPeopleDB,
  initProjectsDB,
  initTemplatesDB,
  ProjectDataObject,
  ProjectID,
  ProjectMetaObject,
  ProjectObject,
  TemplateDetails,
  couchInitialiser,
} from '@faims3/data-model';
import {initialiseJWTKey} from '../authkeys/initJWTKeys';
import {
  CONDUCTOR_DESCRIPTION,
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_PUBLIC_URL,
  COUCHDB_INTERNAL_URL,
  LOCAL_COUCHDB_AUTH,
} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {getAllProjects, getNotebookMetadata} from './notebooks';
import {registerAdminUser} from './users';

const DIRECTORY_DB_NAME = 'directory';
const PROJECTS_DB_NAME = 'projects';
const TEMPLATES_DB_NAME = 'templates';
const AUTH_DB_NAME = 'auth';
const PEOPLE_DB_NAME = 'people';
const INVITE_DB_NAME = 'invites';

let _directoryDB: PouchDB.Database | undefined;
let _projectsDB: PouchDB.Database<ProjectObject> | undefined;
let _templatesDb: PouchDB.Database<TemplateDetails> | undefined;
let _authDB: AuthDatabase | undefined;
let _usersDB: PouchDB.Database<Express.User> | undefined;
let _invitesDB: PouchDB.Database | undefined;

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

export const getDirectoryDB = (): PouchDB.Database => {
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

export const getUsersDB = (): PouchDB.Database<Express.User> => {
  if (!_usersDB) {
    const pouch_options = pouchOptions();
    const dbName = COUCHDB_INTERNAL_URL + '/' + PEOPLE_DB_NAME;
    try {
      _usersDB = new PouchDB<Express.User>(dbName, pouch_options);
    } catch {
      throw new Exceptions.InternalSystemError(
        'Error occurred while getting users database.'
      );
    }
  }

  return _usersDB;
};

export const localGetProjectsDb = (): PouchDB.Database<ProjectObject> => {
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

export const getTemplatesDb = (): PouchDB.Database<TemplateDetails> => {
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

export const getInvitesDB = (): PouchDB.Database | undefined => {
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

/**
 * Returns the metadata DB for a given project - involves fetching the project
 * doc and then fetching the corresponding metadata db
 * @param projectID The project Id to use
 * @returns The metadata DB for this project
 */
export const getMetadataDb = async (
  projectID: ProjectID
): Promise<PouchDB.Database<ProjectMetaObject>> => {
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

  // Now get the metadata DB from the project document
  if (!projectDoc.metadata_db) {
    throw new Exceptions.InternalSystemError(
      "The given project document does not contain a mandatory reference to it's metadata database. Unsure how to fetch metadata DB. Aborting."
    );
  }

  // Build the pouch connection for this DB
  const dbUrl = COUCHDB_INTERNAL_URL + '/' + projectDoc.metadata_db.db_name;
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
export const localGetDataDb = async (
  projectID: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> => {
  // Get the projects DB
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

  // Now get the data DB for this project
  if (!projectDoc.data_db) {
    throw new Exceptions.InternalSystemError(
      "The given project document does not contain a mandatory reference to it's data database. Unsure how to fetch data DB. Aborting."
    );
  }

  // Build the pouch connection for this DB
  const dbUrl = COUCHDB_INTERNAL_URL + '/' + projectDoc.data_db.db_name;
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
  roles = ['admin', 'user', 'team'],
  force = false,
}: {
  projectId: string;
  roles?: string[];
  force?: boolean;
}): Promise<PouchDB.Database<ProjectMetaObject>> => {
  // Are we in a testing environment?
  const isTesting = process.env.NODE_ENV === 'test';

  // Get the metadata DB
  const metaDb = await getMetadataDb(projectId);

  // get roles from the notebook, ensure that 'user' and 'admin' are included
  if (roles.indexOf('user') < 0) {
    roles.push('user');
  }
  if (roles.indexOf('admin') < 0) {
    roles.push('admin');
  }

  try {
    await couchInitialiser({
      db: metaDb,
      content: initMetadataDB({projectId, roles}),
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
  roles = ['admin', 'user', 'team'],
  force = false,
}: {
  projectId: string;
  roles?: string[];
  force?: boolean;
}): Promise<PouchDB.Database<ProjectDataObject>> => {
  // Are we in a testing environment?
  const isTesting = process.env.NODE_ENV === 'test';

  // Get the metadata DB
  const dataDb = await localGetDataDb(projectId);

  // get roles from the notebook, ensure that 'user' and 'admin' are included
  if (roles.indexOf('user') < 0) {
    roles.push('user');
  }
  if (roles.indexOf('admin') < 0) {
    roles.push('admin');
  }

  try {
    await couchInitialiser({
      db: dataDb,
      content: initDataDB({projectId, roles}),
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
 * Critical method which initialises all databases, including remotely on the configured couch instance.
 *
 * This systematically generates a set of initialisation content from the data model, then applies this initialisation using a helper method in the data model.
 *
 * Some local information is injected as part of the config generation step - e.g. conductor name/description.
 *
 * Also initialises keys based on the configured key service.
 *
 * If force = true, documents will always be written, even if it already exists.
 *
 * @param force Write on clash
 */
export const initialiseDbAndKeys = async ({
  force = false,
}: {
  force?: boolean;
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

  // Templates
  let templatesDb: PouchDB.Database;
  try {
    templatesDb = getTemplatesDb();
  } catch {
    throw new Exceptions.InternalSystemError(
      'An error occurred while instantiating the templates DB. Aborting operation.'
    );
  }
  // Users
  const peopleDb = getUsersDB();

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

  // For users, we also establish an admin user, if not already present
  await registerAdminUser(peopleDb);

  // For each project, ensure the metadata and data DBs are also
  // initialised/synced
  const projects = await getAllProjects();

  for (const project of projects) {
    // Project ID
    const projectId = project._id;

    // Try and get the metadata (which has roles in it)
    const roles = ((await getNotebookMetadata(projectId)) ?? undefined)
      ?.accesses as string[] | undefined;

    // Now initialise the DBs (potentially updating security documents etc)
    await initialiseMetadataDb({projectId, roles, force});
    await initialiseDataDb({projectId, roles, force});
  }

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
};
