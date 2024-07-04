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

import {
  COUCHDB_PUBLIC_URL,
  COUCHDB_INTERNAL_URL,
  LOCAL_COUCHDB_AUTH,
} from '../buildconfig';
import {ProjectID, ProjectObject} from 'faims3-datamodel';
import {
  initialiseDirectoryDB,
  initialiseProjectsDB,
  initialiseUserDB,
} from './initialise';

const DIRECTORY_DB_NAME = 'directory';
const PROJECTS_DB_NAME = 'projects';
const PEOPLE_DB_NAME = 'people';
const INVITE_DB_NAME = 'invites';

let _directoryDB: PouchDB.Database | undefined;
let _projectsDB: PouchDB.Database | undefined;
let _usersDB: PouchDB.Database | undefined;
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

/**
 * getPublicUserDbURL -
 * @returns a URL that can be used externaly to access the user database
 */
export const getPublicUserDbURL = (): string => {
  return COUCHDB_PUBLIC_URL + PEOPLE_DB_NAME;
};

export const getUsersDB = (): PouchDB.Database | undefined => {
  if (!_usersDB) {
    const pouch_options = pouchOptions();

    const dbName = COUCHDB_INTERNAL_URL + '/' + PEOPLE_DB_NAME;
    _usersDB = new PouchDB(dbName, pouch_options);
  }

  return _usersDB;
};

export const getProjectsDB = (): PouchDB.Database | undefined => {
  if (!_projectsDB) {
    const pouch_options = pouchOptions();
    const dbName = COUCHDB_INTERNAL_URL + '/' + PROJECTS_DB_NAME;
    try {
      _projectsDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      console.log('bad thing happened', error);
    }
  }
  return _projectsDB;
};

export const getInvitesDB = (): PouchDB.Database | undefined => {
  if (!_invitesDB) {
    const pouch_options = pouchOptions();
    const dbName = COUCHDB_INTERNAL_URL + '/' + INVITE_DB_NAME;
    try {
      _invitesDB = new PouchDB(dbName, pouch_options);
    } catch (error) {
      console.log('bad thing happened', error);
    }
  }
  return _invitesDB;
};

export const getProjectMetaDB = async (
  projectID: ProjectID
): Promise<PouchDB.Database | undefined> => {
  const projectsDB = getProjectsDB();
  if (projectsDB) {
    try {
      const projectDoc = (await projectsDB.get(
        projectID
      )) as unknown as ProjectObject;
      if (projectDoc.metadata_db) {
        const dbname =
          COUCHDB_INTERNAL_URL + '/' + projectDoc.metadata_db.db_name;
        const pouch_options = pouchOptions();

        if (LOCAL_COUCHDB_AUTH !== undefined) {
          pouch_options.auth = LOCAL_COUCHDB_AUTH;
        }
        return new PouchDB(dbname, pouch_options);
      }
    } catch (error) {
      console.error('Error getting project metadata DB for ', projectID);
      return undefined;
    }
  }
  return undefined;
};

export const getProjectDataDB = async (
  projectID: ProjectID
): Promise<PouchDB.Database | undefined> => {
  const projectsDB = getProjectsDB();
  if (projectsDB) {
    try {
      const projectDoc = (await projectsDB.get(
        projectID
      )) as unknown as ProjectObject;
      if (projectDoc.data_db) {
        const dbname = COUCHDB_INTERNAL_URL + '/' + projectDoc.data_db.db_name;
        const pouch_options = pouchOptions();

        if (LOCAL_COUCHDB_AUTH !== undefined) {
          pouch_options.auth = LOCAL_COUCHDB_AUTH;
        }
        return new PouchDB(dbname, pouch_options);
      }
    } catch (error) {
      console.error('Error getting project DB for ', projectID);
      return undefined;
    }
  }
  return undefined;
};

export const initialiseDatabases = async () => {
  const directoryDB = getDirectoryDB();
  try {
    await initialiseDirectoryDB(directoryDB);
  } catch (error) {
    console.log('something wrong with directory db init', error);
  }

  const projectsDB = getProjectsDB();
  try {
    await initialiseProjectsDB(projectsDB);
  } catch (error) {
    console.log('something wrong with projects db init', error);
  }

  const usersDB = getUsersDB();
  try {
    await initialiseUserDB(usersDB);
  } catch (error) {
    console.log('something wrong with user db init', error);
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
