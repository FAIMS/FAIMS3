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
 * Filename: invites.tests.ts
 * Description:
 *   Tests for invite handling
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
const pouchdb_1 = __importDefault(require("pouchdb"));
const notebooks_1 = require("../src/couchdb/notebooks");
const users_1 = require("../src/couchdb/users");
const invites_1 = require("../src/couchdb/invites");
const couchdb_1 = require("../src/couchdb");
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const chai_1 = require("chai");
const uispec = {
    fields: [],
    views: {},
    viewsets: {},
    visible_types: [],
};
describe('Invites', () => {
    beforeEach(couchdb_1.initialiseDatabases);
    it('create invite', () => __awaiter(void 0, void 0, void 0, function* () {
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        const project_id = yield (0, notebooks_1.createNotebook)('Test Notebook', uispec, {});
        const role = 'user';
        const number = 10;
        if (adminUser && project_id) {
            const invite = yield (0, invites_1.createInvite)(adminUser, project_id, role, number);
            // check that it was saved - fetch from db
            const fetched = yield (0, invites_1.getInvite)(invite._id);
            if (fetched) {
                (0, chai_1.expect)(fetched.project_id).to.equal(project_id);
                (0, chai_1.expect)(fetched.number).to.equal(number);
                // get invites for notebook
                const invites = yield (0, invites_1.getInvitesForNotebook)(project_id);
                (0, chai_1.expect)(invites.length).to.equal(1);
                // and now delete it
                const deleted = yield (0, invites_1.deleteInvite)(fetched);
                (0, chai_1.expect)(deleted._deleted).to.be.true;
            }
            else {
                chai_1.assert.fail('could not retrieve newly created invite');
            }
        }
        else {
            chai_1.assert.fail('could not get admin user');
        }
    }));
    it('create unlimited invite', () => __awaiter(void 0, void 0, void 0, function* () {
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        const project_id = yield (0, notebooks_1.createNotebook)('Test Notebook', uispec, {});
        const role = 'user';
        const number = 0;
        if (adminUser && project_id) {
            const invite = yield (0, invites_1.createInvite)(adminUser, project_id, role, number);
            // check that it was saved - fetch from db
            const fetched = yield (0, invites_1.getInvite)(invite._id);
            if (fetched) {
                (0, chai_1.expect)(fetched.project_id).to.equal(project_id);
                (0, chai_1.expect)(fetched.unlimited).to.be.true;
            }
            else {
                chai_1.assert.fail('could not retrieve newly created invite');
            }
        }
        else {
            chai_1.assert.fail('could not get admin user');
        }
    }));
});
