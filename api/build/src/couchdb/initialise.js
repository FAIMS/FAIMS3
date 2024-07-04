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
 * Filename: initialise.js
 * Description:
 *   Functions to initialise the databases required for FAIMS in couchdb
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialiseUserDB = exports.initialiseDirectoryDB = exports.initialiseProjectsDB = void 0;
const local_1 = require("../auth_providers/local");
const buildconfig_1 = require("../buildconfig");
const users_1 = require("./users");
const initialiseProjectsDB = (db) => __awaiter(void 0, void 0, void 0, function* () {
    // Permissions doc goes into _design/permissions in a project
    // javascript in here will run inside CouchDB
    const projectPermissionsDoc = {
        _id: '_design/permissions',
        validate_doc_update: `function (newDoc, oldDoc, userCtx) {
      // Reject update if user does not have an _admin role
      if (userCtx.roles.indexOf('_admin') < 0) {
        throw {
          unauthorized:
            \`Access denied for \${userCtx.roles}. Only the Fieldmark server may modify projects\`,
        };
      }
    }`,
    };
    if (db) {
        try {
            yield db.get(projectPermissionsDoc._id);
        }
        catch (_a) {
            yield db.put(projectPermissionsDoc);
        }
        // can't save security on an in-memory database so skip if testing
        if (process.env.NODE_ENV !== 'test') {
            const security = db.security();
            security.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            security.admins.roles.add('_admin');
            security.members.roles.removeAll();
            yield security.save();
        }
    }
});
exports.initialiseProjectsDB = initialiseProjectsDB;
const initialiseDirectoryDB = (db) => __awaiter(void 0, void 0, void 0, function* () {
    const directoryDoc = {
        _id: 'default',
        name: buildconfig_1.CONDUCTOR_INSTANCE_NAME,
        description: `Fieldmark instance on ${buildconfig_1.CONDUCTOR_PUBLIC_URL}`,
        people_db: {
            db_name: 'people',
        },
        projects_db: {
            db_name: 'projects',
        },
        conductor_url: `${buildconfig_1.CONDUCTOR_PUBLIC_URL}/`,
    };
    const permissions = {
        _id: '_design/permissions',
        validate_doc_update: `function(newDoc, oldDoc, userCtx) {
      if (userCtx.roles.indexOf('_admin') >= 0) {
        return;
      }
      throw({forbidden: "Access denied. Only the Fieldmark admin can modify the directory."});
    }`,
    };
    if (db) {
        // do we already have a default document?
        try {
            yield db.get('default');
        }
        catch (_b) {
            yield db.put(directoryDoc);
            yield db.put(permissions);
            // can't save security on an in-memory database so skip if testing
            if (process.env.NODE_ENV !== 'test') {
                // directory needs to be public
                const security = db.security();
                security.admins.roles.removeAll();
                security.members.roles.removeAll();
                yield security.save();
            }
        }
    }
});
exports.initialiseDirectoryDB = initialiseDirectoryDB;
const initialiseUserDB = (db) => __awaiter(void 0, void 0, void 0, function* () {
    // register a local admin user with the same password as couchdb
    // if there isn't already one there
    if (db && buildconfig_1.LOCAL_COUCHDB_AUTH) {
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            return;
        }
        // can't save security on an in-memory database so skip if testing
        if (process.env.NODE_ENV !== 'test') {
            const security = db.security();
            security.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            security.members.roles.removeAll();
            yield security.save();
        }
        const [user, error] = yield (0, local_1.registerLocalUser)('admin', '', // no email address
        'Admin User', buildconfig_1.LOCAL_COUCHDB_AUTH.password);
        if (user) {
            (0, users_1.addOtherRoleToUser)(user, buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            (0, users_1.saveUser)(user);
        }
        else {
            console.error(error);
        }
    }
});
exports.initialiseUserDB = initialiseUserDB;
