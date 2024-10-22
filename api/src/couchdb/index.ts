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

import {
  AuthDatabase,
  ProjectDataObject,
  ProjectID,
  ProjectMetaObject,
  ProjectObject,
  TemplateDetails,
} from '@faims3/data-model';
import PouchDB from 'pouchdb';
import {initialiseJWTKey} from '../authkeys/initJWTKeys';
import {
  COUCHDB_INTERNAL_URL,
  COUCHDB_PUBLIC_URL,
  LOCAL_COUCHDB_AUTH,
} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {
  initialiseAuthDb,
  initialiseDirectoryDB,
  initialiseProjectsDB,
  initialiseTemplatesDb,
  initialiseUserDB,
} from './initialise';

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

export const getDirectoryDB = (): PouchDB.Database | undefined => {
  if (!_directoryDB) {
    const pouch_options = pouchOptions();

    const directorydb = COUCHDB_INTERNAL_URL + '/' + DIRECTORY_DB_NAME;
    try {
      _directoryDB = new PouchDB(directorydb, pouch_options);
    } catch (error) {
      console.log('bad thing happened', error);
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

/**
 * getPublicUserDbURL -
 * @returns a URL that can be used externaly to access the user database
 */
export const getPublicUserDbURL = (): string => {
  return COUCHDB_PUBLIC_URL + PEOPLE_DB_NAME;
};

export const getUsersDB = (): PouchDB.Database<Express.User> | undefined => {
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

export const getProjectsDB = ():
  | PouchDB.Database<ProjectObject>
  | undefined => {
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
  const projectsDB = getProjectsDB();
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
export const getDataDb = async (
  projectID: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> => {
  // Get the projects DB
  const projectsDB = getProjectsDB();
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

export const initialiseDatabases = async () => {
  // Setup the auth DB
  const authDB = getAuthDB();
  try {
    await initialiseAuthDb(authDB);
  } catch (error) {
    console.log('Could not initialise the auth database', error);
    throw error;
  }

  const directoryDB = getDirectoryDB();
  try {
    await initialiseDirectoryDB(directoryDB);
  } catch (error) {
    console.log('something wrong with directory db init', error);
    throw error;
  }

  const projectsDB = getProjectsDB();
  try {
    await initialiseProjectsDB(projectsDB);
  } catch (error) {
    console.log('something wrong with projects db init', error);
    throw error;
  }

  let templatesDb: PouchDB.Database;
  try {
    templatesDb = getTemplatesDb();
  } catch {
    throw new Exceptions.InternalSystemError(
      'An error occurred while instantiating the templates local DB. Aborting operation.'
    );
  }

  try {
    await initialiseTemplatesDb(templatesDb);
  } catch {
    throw new Exceptions.InternalSystemError(
      'Something wrong during templates db initialisation'
    );
  }

  const usersDB = getUsersDB();
  try {
    await initialiseUserDB(usersDB);
  } catch (error) {
    console.log('something wrong with user db init', error);
    throw error;
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

export const closeDatabases = async () => {
  if (_projectsDB) {
    try {
      await _projectsDB.close();
      _projectsDB = undefined;
    } catch (error) {
      console.log(error);
    }
  }
  if (_directoryDB) {
    try {
      await _directoryDB.close();
      _directoryDB = undefined;
    } catch (error) {
      console.log(error);
    }
  }
};
