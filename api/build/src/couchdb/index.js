"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabases = exports.initialiseDatabases = exports.getProjectDataDB = exports.getProjectMetaDB = exports.getInvitesDB = exports.getProjectsDB = exports.getUsersDB = exports.getPublicUserDbURL = exports.getDirectoryDB = void 0;
const pouchdb_1 = __importDefault(require("pouchdb"));
const buildconfig_1 = require("../buildconfig");
const initialise_1 = require("./initialise");
const DIRECTORY_DB_NAME = 'directory';
const PROJECTS_DB_NAME = 'projects';
const PEOPLE_DB_NAME = 'people';
const INVITE_DB_NAME = 'invites';
let _directoryDB;
let _projectsDB;
let _usersDB;
let _invitesDB;
const pouchOptions = () => {
    const options = {};
    if (process.env.NODE_ENV === 'test') {
        options.adapter = 'memory';
    }
    if (buildconfig_1.LOCAL_COUCHDB_AUTH !== undefined) {
        options.auth = buildconfig_1.LOCAL_COUCHDB_AUTH;
    }
    return options;
};
const getDirectoryDB = () => {
    if (!_directoryDB) {
        const pouch_options = pouchOptions();
        const directorydb = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + DIRECTORY_DB_NAME;
        try {
            _directoryDB = new pouchdb_1.default(directorydb, pouch_options);
        }
        catch (error) {
            console.log('bad thing happened', error);
        }
    }
    return _directoryDB;
};
exports.getDirectoryDB = getDirectoryDB;
/**
 * getPublicUserDbURL -
 * @returns a URL that can be used externaly to access the user database
 */
const getPublicUserDbURL = () => {
    return buildconfig_1.COUCHDB_PUBLIC_URL + PEOPLE_DB_NAME;
};
exports.getPublicUserDbURL = getPublicUserDbURL;
const getUsersDB = () => {
    if (!_usersDB) {
        const pouch_options = pouchOptions();
        const dbName = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + PEOPLE_DB_NAME;
        _usersDB = new pouchdb_1.default(dbName, pouch_options);
    }
    return _usersDB;
};
exports.getUsersDB = getUsersDB;
const getProjectsDB = () => {
    if (!_projectsDB) {
        const pouch_options = pouchOptions();
        const dbName = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + PROJECTS_DB_NAME;
        try {
            _projectsDB = new pouchdb_1.default(dbName, pouch_options);
        }
        catch (error) {
            console.log('bad thing happened', error);
        }
    }
    return _projectsDB;
};
exports.getProjectsDB = getProjectsDB;
const getInvitesDB = () => {
    if (!_invitesDB) {
        const pouch_options = pouchOptions();
        const dbName = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + INVITE_DB_NAME;
        try {
            _invitesDB = new pouchdb_1.default(dbName, pouch_options);
        }
        catch (error) {
            console.log('bad thing happened', error);
        }
    }
    return _invitesDB;
};
exports.getInvitesDB = getInvitesDB;
const getProjectMetaDB = (projectID) => __awaiter(void 0, void 0, void 0, function* () {
    const projectsDB = (0, exports.getProjectsDB)();
    if (projectsDB) {
        try {
            const projectDoc = (yield projectsDB.get(projectID));
            if (projectDoc.metadata_db) {
                const dbname = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + projectDoc.metadata_db.db_name;
                const pouch_options = pouchOptions();
                if (buildconfig_1.LOCAL_COUCHDB_AUTH !== undefined) {
                    pouch_options.auth = buildconfig_1.LOCAL_COUCHDB_AUTH;
                }
                return new pouchdb_1.default(dbname, pouch_options);
            }
        }
        catch (error) {
            console.error('Error getting project metadata DB for ', projectID);
            return undefined;
        }
    }
    return undefined;
});
exports.getProjectMetaDB = getProjectMetaDB;
const getProjectDataDB = (projectID) => __awaiter(void 0, void 0, void 0, function* () {
    const projectsDB = (0, exports.getProjectsDB)();
    if (projectsDB) {
        try {
            const projectDoc = (yield projectsDB.get(projectID));
            if (projectDoc.data_db) {
                const dbname = buildconfig_1.COUCHDB_INTERNAL_URL + '/' + projectDoc.data_db.db_name;
                const pouch_options = pouchOptions();
                if (buildconfig_1.LOCAL_COUCHDB_AUTH !== undefined) {
                    pouch_options.auth = buildconfig_1.LOCAL_COUCHDB_AUTH;
                }
                return new pouchdb_1.default(dbname, pouch_options);
            }
        }
        catch (error) {
            console.error('Error getting project DB for ', projectID);
            return undefined;
        }
    }
    return undefined;
});
exports.getProjectDataDB = getProjectDataDB;
const initialiseDatabases = () => __awaiter(void 0, void 0, void 0, function* () {
    const directoryDB = (0, exports.getDirectoryDB)();
    try {
        yield (0, initialise_1.initialiseDirectoryDB)(directoryDB);
    }
    catch (error) {
        console.log('something wrong with directory db init', error);
    }
    const projectsDB = (0, exports.getProjectsDB)();
    try {
        yield (0, initialise_1.initialiseProjectsDB)(projectsDB);
    }
    catch (error) {
        console.log('something wrong with projects db init', error);
    }
    const usersDB = (0, exports.getUsersDB)();
    try {
        yield (0, initialise_1.initialiseUserDB)(usersDB);
    }
    catch (error) {
        console.log('something wrong with user db init', error);
    }
});
exports.initialiseDatabases = initialiseDatabases;
const closeDatabases = () => __awaiter(void 0, void 0, void 0, function* () {
    if (_projectsDB) {
        try {
            yield _projectsDB.close();
            _projectsDB = undefined;
        }
        catch (error) {
            console.log(error);
        }
    }
    if (_directoryDB) {
        try {
            yield _directoryDB.close();
            _directoryDB = undefined;
        }
        catch (error) {
            console.log(error);
        }
    }
});
exports.closeDatabases = closeDatabases;
