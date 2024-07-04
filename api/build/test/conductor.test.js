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
 * Filename: conductor.test.ts
 * Description:
 *   Tests of the main routes in conductor
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
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const supertest_1 = __importDefault(require("supertest"));
const routes_1 = require("../src/routes");
const buildconfig_1 = require("../src/buildconfig");
const chai_1 = require("chai");
const mocks_1 = require("./mocks");
const users_1 = require("../src/couchdb/users");
const notebooks_1 = require("../src/couchdb/notebooks");
const fs_1 = __importDefault(require("fs"));
const local_1 = require("../src/auth_providers/local");
it('check is up', () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield (0, supertest_1.default)(routes_1.app).get('/up');
    (0, chai_1.expect)(result.statusCode).to.equal(200);
}));
const localUserName = 'bobalooba';
const localUserPassword = 'bobalooba';
const adminPassword = buildconfig_1.LOCAL_COUCHDB_AUTH ? buildconfig_1.LOCAL_COUCHDB_AUTH.password : '';
const notebookUser = 'notebook';
const notebookPassword = 'notebook';
describe('Auth', () => {
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, mocks_1.resetDatabases)();
        yield (0, mocks_1.cleanDataDBS)();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [user, _error] = yield (0, users_1.createUser)('', localUserName);
        if (user) {
            yield (0, users_1.saveUser)(user);
            yield (0, local_1.addLocalPasswordForUser)(user, localUserPassword); // saves the user
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [nbUser, _nberror] = yield (0, users_1.createUser)('', notebookUser);
        if (nbUser) {
            yield (0, users_1.addOtherRoleToUser)(nbUser, buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME);
            yield (0, local_1.addLocalPasswordForUser)(nbUser, notebookPassword); // saves the user
        }
    }));
    it('redirect to auth', done => {
        (0, supertest_1.default)(routes_1.app)
            .get('/')
            .expect(302)
            .expect('Location', /\/auth/, done);
    });
    it('logout redirects to /', done => {
        (0, supertest_1.default)(routes_1.app).get('/logout/').expect(302).expect('Location', '/', done);
    });
    it('auth returns HTML', done => {
        (0, supertest_1.default)(routes_1.app)
            .get('/auth')
            .expect(200)
            .expect('Content-Type', /text\/html/, done);
    });
    it('shows local login form', done => {
        (0, supertest_1.default)(routes_1.app)
            .get('/auth')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('Local Login');
            done();
        });
    });
    it('shows the configured login button(s)', done => {
        (0, supertest_1.default)(routes_1.app)
            .get('/auth')
            .expect(200)
            .then(response => {
            buildconfig_1.CONDUCTOR_AUTH_PROVIDERS.forEach((provider) => {
                (0, chai_1.expect)(response.text).to.include(provider);
            });
            done();
        });
    });
    it('shows the notebooks page', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: 'admin', password: adminPassword })
            .expect(302);
        yield agent
            .get('/notebooks/')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('test-notebook');
            (0, chai_1.expect)(response.text).to.include('Upload a Notebook');
        });
    }));
    it("doesn't show the notebooks page when not logged in", () => __awaiter(void 0, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(routes_1.app);
        // expect a redirect to login
        yield agent.get('/notebooks/').expect(302);
    }));
    it('shows the add notebook option for a notebook-creater user', () => __awaiter(void 0, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: notebookUser, password: notebookPassword })
            .expect(302);
        yield agent
            .get('/notebooks/')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('Upload a Notebook');
        });
    }));
    it("doesn't show the add notebook option for a regular user", () => __awaiter(void 0, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: localUserName, password: localUserPassword })
            .expect(302);
        yield agent
            .get('/notebooks/')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).not.to.include('Upload a Notebook');
        });
    }));
    it('shows page for one notebook', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const project_id = yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: 'admin', password: adminPassword })
            .expect(302);
        yield agent
            .get(`/notebooks/${project_id}/`)
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('test-notebook');
        });
    }));
    it('shows notebook users page for admin user', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const project_id = yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: 'admin', password: adminPassword })
            .expect(302);
        yield agent
            .get(`/notebooks/${project_id}/users`)
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('admin');
        });
    }));
    it('get home page logged in', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: 'admin', password: adminPassword })
            .expect(302);
        yield agent
            .get('/')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('Admin User');
        });
    }));
    it('shows users page for admin user', () => __awaiter(void 0, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: 'admin', password: adminPassword })
            .expect(302);
        yield agent
            .get('/users')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.text).to.include('admin');
        });
    }));
    it('does not show the users page for regular user', () => __awaiter(void 0, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(routes_1.app);
        yield agent
            .post('/auth/local/')
            .send({ username: localUserName, password: localUserPassword })
            .expect(302);
        yield agent.get('/users').expect(401);
    }));
});
