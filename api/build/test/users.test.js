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
 * Filename: users.tests.ts
 * Description:
 *   Tests for user handling
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const pouchdb_1 = __importDefault(require("pouchdb"));
const local_1 = require("../src/auth_providers/local");
const buildconfig_1 = require("../src/buildconfig");
const couchdb_1 = require("../src/couchdb");
const users_1 = require("../src/couchdb/users");
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const notebooks_1 = require("../src/couchdb/notebooks");
const clearUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    const usersDB = (0, couchdb_1.getUsersDB)();
    if (usersDB) {
        const docs = yield usersDB.allDocs();
        for (let i = 0; i < docs.rows.length; i++) {
            yield usersDB.remove(docs.rows[i].id, docs.rows[i].value.rev);
        }
    }
});
describe('user creation', () => {
    beforeEach(clearUsers);
    it('create user - good', () => __awaiter(void 0, void 0, void 0, function* () {
        const email = 'BOB@Here.com';
        const username = 'bobalooba';
        const [newUserUsername, errorUsername] = yield (0, users_1.createUser)('', username);
        (0, chai_1.expect)(errorUsername).to.equal('');
        if (newUserUsername) {
            (0, chai_1.expect)(newUserUsername.user_id).to.equal(username);
            (0, chai_1.expect)(newUserUsername.emails.length).to.equal(0);
        }
        else {
            chai_1.assert.fail('user is null after createUser with valid username');
        }
        const [newUserEmail, errorEmail] = yield (0, users_1.createUser)(email, '');
        (0, chai_1.expect)(errorEmail).to.equal('');
        if (newUserEmail) {
            (0, chai_1.expect)(newUserEmail.user_id).not.to.equal('');
            (0, chai_1.expect)(newUserEmail.emails).to.include(email.toLowerCase());
        }
        else {
            chai_1.assert.fail('user is null after createUser with valid email');
        }
    }));
    it('create user - duplicates and missing', () => __awaiter(void 0, void 0, void 0, function* () {
        const email = 'BOBBY@here.com';
        const username = 'bobalooba';
        const [newUser, errorFirst] = yield (0, users_1.createUser)(email, '');
        (0, chai_1.expect)(errorFirst).to.equal('');
        if (newUser) {
            yield (0, users_1.saveUser)(newUser);
            // now make another user with the same email
            const [anotherUser, errorSecond] = yield (0, users_1.createUser)(email, '');
            (0, chai_1.expect)(errorSecond).to.equal(`User with email '${email}' already exists`);
            (0, chai_1.expect)(anotherUser).to.be.null;
        }
        const [newUserU, errorFirstU] = yield (0, users_1.createUser)('', username);
        (0, chai_1.expect)(errorFirstU).to.equal('');
        if (newUserU) {
            yield (0, users_1.saveUser)(newUserU);
            // now make another user with the same email
            const [anotherUserU, errorSecondU] = yield (0, users_1.createUser)('', username);
            (0, chai_1.expect)(errorSecondU).to.equal(`User with username '${username}' already exists`);
            (0, chai_1.expect)(anotherUserU).to.be.null;
        }
        const [newUserM, errorM] = yield (0, users_1.createUser)('', '');
        (0, chai_1.expect)(errorM).to.equal('At least one of username and email is required');
        (0, chai_1.expect)(newUserM).to.be.null;
    }));
    it('user roles', () => __awaiter(void 0, void 0, void 0, function* () {
        const email = 'BOBBY@here.com';
        const username = 'bobalooba';
        const [newUser, error] = yield (0, users_1.createUser)(email, username);
        (0, chai_1.expect)(error).to.equal('');
        if (newUser) {
            // add some roles
            (0, users_1.addOtherRoleToUser)(newUser, 'cluster-admin');
            (0, users_1.addOtherRoleToUser)(newUser, 'chief-bobalooba');
            // check that 'roles' has been updated
            (0, chai_1.expect)(newUser.roles.length).to.equal(2);
            (0, chai_1.expect)(newUser.roles).to.include('cluster-admin');
            (0, chai_1.expect)(newUser.roles).to.include('chief-bobalooba');
            (0, users_1.addProjectRoleToUser)(newUser, 'important-project', 'admin');
            (0, chai_1.expect)(newUser.other_roles.length).to.equal(2);
            (0, chai_1.expect)(newUser.other_roles).to.include('cluster-admin');
            (0, chai_1.expect)(newUser.other_roles).to.include('chief-bobalooba');
            (0, chai_1.expect)(Object.keys(newUser.project_roles)).to.include('important-project');
            (0, chai_1.expect)(newUser.project_roles['important-project']).to.include('admin');
            (0, chai_1.expect)(newUser.roles.length).to.equal(3);
            (0, chai_1.expect)(newUser.roles).to.include('important-project||admin');
            // add more project roles
            (0, users_1.addProjectRoleToUser)(newUser, 'important-project', 'team');
            (0, chai_1.expect)(newUser.project_roles['important-project']).to.include('admin');
            (0, chai_1.expect)(newUser.project_roles['important-project']).to.include('team');
            (0, chai_1.expect)(newUser.project_roles['important-project'].length).to.equal(2);
            (0, chai_1.expect)(newUser.roles.length).to.equal(4);
            (0, chai_1.expect)(newUser.roles).to.include('cluster-admin');
            (0, chai_1.expect)(newUser.roles).to.include('chief-bobalooba');
            (0, chai_1.expect)(newUser.roles).to.include('important-project||admin');
            (0, chai_1.expect)(newUser.roles).to.include('important-project||team');
            // doing it again should be a no-op
            (0, users_1.addProjectRoleToUser)(newUser, 'important-project', 'team');
            (0, chai_1.expect)(newUser.project_roles['important-project'].length).to.equal(2);
            (0, users_1.addOtherRoleToUser)(newUser, 'cluster-admin');
            (0, chai_1.expect)(newUser.other_roles.length).to.equal(2);
            (0, chai_1.expect)(newUser.roles.length).to.equal(4);
            (0, chai_1.expect)(newUser.roles).to.include('cluster-admin');
            (0, chai_1.expect)(newUser.roles).to.include('chief-bobalooba');
            (0, chai_1.expect)(newUser.roles).to.include('important-project||admin');
            (0, chai_1.expect)(newUser.roles).to.include('important-project||team');
            // remove one
            (0, users_1.removeProjectRoleFromUser)(newUser, 'important-project', 'admin');
            (0, chai_1.expect)(newUser.project_roles['important-project']).not.to.include('admin');
            (0, chai_1.expect)(newUser.project_roles['important-project']).to.include('team');
            (0, users_1.removeOtherRoleFromUser)(newUser, 'cluster-admin');
            (0, chai_1.expect)(newUser.other_roles.length).to.equal(1);
            (0, chai_1.expect)(newUser.other_roles).to.include('chief-bobalooba');
            (0, chai_1.expect)(newUser.other_roles).not.to.include('cluster-admin');
            (0, chai_1.expect)(newUser.roles.length).to.equal(2);
            (0, chai_1.expect)(newUser.roles).not.to.include('cluster-admin');
            (0, chai_1.expect)(newUser.roles).to.include('chief-bobalooba');
            (0, chai_1.expect)(newUser.roles).not.to.include('important-project||admin');
            (0, chai_1.expect)(newUser.roles).to.include('important-project||team');
            // remove roles that aren't there should be harmless
            (0, users_1.removeProjectRoleFromUser)(newUser, 'important-project', 'not-there');
            (0, chai_1.expect)(newUser.project_roles['important-project'].length).to.equal(1);
            (0, users_1.removeOtherRoleFromUser)(newUser, 'non-existant');
            (0, chai_1.expect)(newUser.other_roles.length).to.equal(1);
            (0, chai_1.expect)(newUser.other_roles).to.include('chief-bobalooba');
        }
    }));
    it('checking permissions', () => __awaiter(void 0, void 0, void 0, function* () {
        const email = 'BOBBY@here.com';
        const username = 'bobalooba';
        const project_id = 'myProject';
        const [user, error] = yield (0, users_1.createUser)(email, username);
        (0, chai_1.expect)(error).to.equal('');
        if (user) {
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'read')).to.be.false;
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'modify')).to.be.false;
            // add some roles
            (0, users_1.addOtherRoleToUser)(user, buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'read')).to.be.true;
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'modify')).to.be.true;
            (0, users_1.removeOtherRoleFromUser)(user, buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            // test permissions for user role
            (0, users_1.addProjectRoleToUser)(user, project_id, 'user');
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'read')).to.be.true;
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'modify')).to.be.false;
            // but can't access another project
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, 'anotherProject', 'read')).to.be.false;
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, 'anotherProject', 'modify')).to.be.false;
            // give them admin permission
            (0, users_1.addProjectRoleToUser)(user, project_id, 'admin');
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'read')).to.be.true;
            (0, chai_1.expect)((0, users_1.userHasPermission)(user, project_id, 'modify')).to.be.true;
        }
    }));
    it('add local password', () => __awaiter(void 0, void 0, void 0, function* () {
        const username = 'bobalooba';
        const password = 'verysecret';
        const [user, error] = yield (0, users_1.createUser)('', username);
        (0, chai_1.expect)(error).to.equal('');
        if (user) {
            yield (0, local_1.addLocalPasswordForUser)(user, password);
            const profile = user.profiles['local']; // really LocalProfile
            (0, chai_1.expect)(profile).not.to.be.undefined;
            (0, chai_1.expect)(profile.salt).not.to.be.null;
            (0, chai_1.expect)(profile.password).not.to.be.null;
            yield (0, local_1.validateLocalUser)(username, password, (error, validUser) => {
                (0, chai_1.expect)(validUser).not.to.be.false;
                if (validUser) {
                    (0, chai_1.expect)(validUser.user_id).to.equal(username);
                    (0, chai_1.expect)(error).to.be.null;
                }
            });
            yield (0, local_1.validateLocalUser)(username, 'not the password', (error, validUser) => {
                (0, chai_1.expect)(validUser).to.be.false;
                (0, chai_1.expect)(error).to.be.null;
            });
        }
        else {
            chai_1.assert.fail('user is null after createUser with valid username');
        }
    }));
    it('listing users for notebooks', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const name = 'Test Notebook';
        const project_id = yield (0, notebooks_1.createNotebook)(name, uiSpec, metadata);
        const username = 'bobalooba';
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [user, error] = yield (0, users_1.createUser)('', username);
        if (user && project_id) {
            (0, users_1.addProjectRoleToUser)(user, project_id, 'team');
            (0, users_1.addProjectRoleToUser)(user, project_id, 'moderator');
            yield (0, users_1.saveUser)(user);
            const userInfo = yield (0, users_1.getUserInfoForNotebook)(project_id);
            (0, chai_1.expect)(userInfo.roles).to.include('admin');
            (0, chai_1.expect)(userInfo.roles).to.include('moderator');
            (0, chai_1.expect)(userInfo.roles).to.include('team');
            // should have the admin user and this new one
            (0, chai_1.expect)(userInfo.users.length).to.equal(2);
            (0, chai_1.expect)(userInfo.users[1].username).to.equal(username);
            (0, chai_1.expect)(userInfo.users[1].roles[0].value).to.be.false;
        }
    }));
});
