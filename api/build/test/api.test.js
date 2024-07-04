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
 * Filename: api.test.ts
 * Description:
 *   Tests for the API
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
const users_1 = require("../src/couchdb/users");
const create_1 = require("../src/authkeys/create");
const signing_keys_1 = require("../src/authkeys/signing_keys");
const fs_1 = __importDefault(require("fs"));
const notebooks_1 = require("../src/couchdb/notebooks");
const buildconfig_1 = require("../src/buildconfig");
const chai_1 = require("chai");
const mocks_1 = require("./mocks");
const backupRestore_1 = require("../src/couchdb/backupRestore");
const local_1 = require("../src/auth_providers/local");
const uispec = {
    fields: [],
    views: {},
    viewsets: {},
    visible_types: [],
};
let adminToken = '';
const localUserName = 'bobalooba';
const localUserPassword = 'bobalooba';
let localUserToken = '';
const notebookUserName = 'notebook';
const notebookPassword = 'notebook';
let notebookUserToken = '';
describe('API tests', () => {
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, mocks_1.resetDatabases)();
        yield (0, mocks_1.cleanDataDBS)();
        const signing_key = yield (0, signing_keys_1.getSigningKey)();
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            adminToken = yield (0, create_1.createAuthKey)(adminUser, signing_key);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [user, _error] = yield (0, users_1.createUser)('', localUserName);
            if (user) {
                yield (0, users_1.saveUser)(user);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [localUser, _error] = yield (0, users_1.createUser)('', localUserName);
        if (localUser) {
            yield (0, users_1.saveUser)(localUser);
            yield (0, local_1.addLocalPasswordForUser)(localUser, localUserPassword); // saves the user
            localUserToken = yield (0, create_1.createAuthKey)(localUser, signing_key);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [nbUser, _nberror] = yield (0, users_1.createUser)('', notebookUserName);
        if (nbUser) {
            yield (0, users_1.addOtherRoleToUser)(nbUser, buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME);
            yield (0, local_1.addLocalPasswordForUser)(nbUser, notebookPassword); // saves the user
            notebookUserToken = yield (0, create_1.createAuthKey)(nbUser, signing_key);
        }
    }));
    it('check is up - not authenticated', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield (0, supertest_1.default)(routes_1.app).get('/api/hello');
        (0, chai_1.expect)(result.statusCode).to.equal(401);
    }));
    it('check is up - authenticated', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield (0, supertest_1.default)(routes_1.app)
            .get('/api/hello')
            .set('Authorization', `Bearer ${adminToken}`);
        (0, chai_1.expect)(result.statusCode).to.equal(200);
    }));
    it('get notebooks', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        return (0, supertest_1.default)(routes_1.app)
            .get('/api/notebooks')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .expect(response => {
            (0, chai_1.expect)(response.body).to.have.lengthOf(1);
        });
    }));
    it('can create a notebook', () => {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        return (0, supertest_1.default)(routes_1.app)
            .post('/api/notebooks')
            .send({
            'ui-specification': uiSpec,
            metadata: metadata,
            name: 'test notebook',
        })
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200)
            .expect(response => {
            (0, chai_1.expect)(response.body.notebook).to.include('-test-notebook');
        });
    });
    it('will not create a notebook if not authorised', () => {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        return (0, supertest_1.default)(routes_1.app)
            .post('/api/notebooks')
            .send({
            'ui-specification': uiSpec,
            metadata: metadata,
            name: 'test notebook',
        })
            .set('Authorization', `Bearer ${localUserToken}`)
            .set('Content-Type', 'application/json')
            .expect(401);
    });
    it('can create a notebook and set up ownership', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const response = yield (0, supertest_1.default)(routes_1.app)
            .post('/api/notebooks')
            .send({
            'ui-specification': uiSpec,
            metadata: metadata,
            name: 'test notebook',
        })
            .set('Authorization', `Bearer ${notebookUserToken}`)
            .set('Content-Type', 'application/json')
            .expect(200);
        const project_id = response.body.notebook;
        (0, chai_1.expect)(project_id).not.to.be.undefined;
        (0, chai_1.expect)(project_id).to.include('-test-notebook');
        const notebookUser = yield (0, users_1.getUserFromEmailOrUsername)(notebookUserName);
        if (notebookUser) {
            // check that this user now has the right roles on this notebook
            (0, chai_1.expect)((0, users_1.userHasProjectRole)(notebookUser, project_id, 'admin')).to.be.true;
        }
        else {
            console.log('notebookUser', notebookUser);
            (0, chai_1.expect)(notebookUser).not.to.be.null;
        }
    }));
    it('update notebook', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        // create notebook
        const response = yield (0, supertest_1.default)(routes_1.app)
            .post('/api/notebooks')
            .send({
            'ui-specification': uiSpec,
            metadata: metadata,
            name: 'test notebook',
        })
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200);
        const projectID = response.body.notebook;
        // update the notebook
        metadata['name'] = 'Updated Test Notebook';
        metadata['project_lead'] = 'Bob Bobalooba';
        uiSpec.fviews['FORM1SECTION1']['label'] = 'Updated Label';
        // add a new autoincrementer field
        const newField = {
            'component-namespace': 'faims-custom',
            'component-name': 'BasicAutoIncrementer',
            'type-returned': 'faims-core::String',
            'component-parameters': {
                name: 'newincrementor',
                id: 'newincrementor',
                variant: 'outlined',
                required: false,
                num_digits: 5,
                form_id: 'FORM1SECTION1',
                label: 'FeatureIDincrementor',
            },
            validationSchema: [['yup.string'], ['yup.required']],
            initialValue: null,
            access: ['admin'],
            meta: {
                annotation_label: 'annotation',
                annotation: true,
                uncertainty: {
                    include: false,
                    label: 'uncertainty',
                },
            },
        };
        uiSpec.fields['newincrementor'] = newField;
        uiSpec.fviews['FORM1SECTION1']['fields'].push('newincrementor');
        const newResponse = yield (0, supertest_1.default)(routes_1.app)
            .put(`/api/notebooks/${projectID}`)
            .send({
            'ui-specification': uiSpec,
            metadata: metadata,
            name: 'test notebook',
        })
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200);
        (0, chai_1.expect)(newResponse.body.notebook).to.include('-test-notebook');
        const newNotebook = yield (0, notebooks_1.getNotebookMetadata)(projectID);
        if (newNotebook) {
            (0, chai_1.expect)(newNotebook.name).to.equal('Updated Test Notebook');
        }
        else {
            (0, chai_1.expect)(newNotebook).not.to.be.null;
        }
    }));
    it('get notebook', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const project_id = yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        (0, chai_1.expect)(project_id).not.to.be.undefined;
        return (0, supertest_1.default)(routes_1.app)
            .get('/api/notebooks/' + project_id)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200)
            .expect(response => {
            (0, chai_1.expect)(response.body.metadata.name).to.equal('test-notebook');
        });
    }));
    it('can delete a notebook', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            const project_id = yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
            let notebooks = yield (0, notebooks_1.getNotebooks)(adminUser);
            (0, chai_1.expect)(notebooks).to.have.lengthOf(1);
            (0, chai_1.expect)(project_id).not.to.be.undefined;
            yield (0, supertest_1.default)(routes_1.app)
                .post('/api/notebooks/' + project_id + '/delete')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .expect(302)
                .expect('Location', '/notebooks/');
            notebooks = yield (0, notebooks_1.getNotebooks)(adminUser);
            (0, chai_1.expect)(notebooks).to.be.empty;
        }
    }));
    it('update admin user - no auth', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, supertest_1.default)(routes_1.app)
            .post(`/api/users/${localUserName}/admin`)
            .send({ addrole: true })
            .set('Content-Type', 'application/json')
            .expect(401);
    }));
    it('update admin user - add cluster admin role', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, supertest_1.default)(routes_1.app)
            .post(`/api/users/${localUserName}/admin`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ addrole: true, role: buildconfig_1.CLUSTER_ADMIN_GROUP_NAME })
            .expect(200)
            .expect({ status: 'success' });
    }));
    it('update admin user - remove cluster admin role', () => {
        return (0, supertest_1.default)(routes_1.app)
            .post(`/api/users/${localUserName}/admin`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ addrole: false, role: buildconfig_1.CLUSTER_ADMIN_GROUP_NAME })
            .expect(200)
            .expect({ status: 'success' });
    });
    it('update admin user - add notebook creator role', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, supertest_1.default)(routes_1.app)
            .post(`/api/users/${localUserName}/admin`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ addrole: true, role: buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME })
            .expect(200)
            .expect({ status: 'success' });
    }));
    it('update admin user - fail to add unknown role', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, supertest_1.default)(routes_1.app)
            .post(`/api/users/${localUserName}/admin`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .send({ addrole: true, role: 'unknown-role' })
            .expect(404)
            .expect({ status: 'error', error: 'Unknown role' });
    }));
    it('get notebook users', () => __awaiter(void 0, void 0, void 0, function* () {
        const filename = 'notebooks/sample_notebook.json';
        const jsonText = fs_1.default.readFileSync(filename, 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const project_id = yield (0, notebooks_1.createNotebook)('test-notebook', uiSpec, metadata);
        return (0, supertest_1.default)(routes_1.app)
            .get(`/api/notebooks/${project_id}/users`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200)
            .then(response => {
            (0, chai_1.expect)(response.body.roles).to.deep.equal([
                'admin',
                'moderator',
                'team',
                'user',
            ]);
            (0, chai_1.expect)(response.body.users.length).to.equal(1);
        });
    }));
    it('update notebook roles', () => __awaiter(void 0, void 0, void 0, function* () {
        // make some notebooks
        const nb1 = yield (0, notebooks_1.createNotebook)('NB1', uispec, {});
        if (nb1) {
            yield (0, supertest_1.default)(routes_1.app)
                .post(`/api/notebooks/${nb1}/users/`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .send({
                username: localUserName,
                role: 'user',
                addrole: true,
            })
                .expect({ status: 'success' })
                .expect(200);
            // take it away again
            yield (0, supertest_1.default)(routes_1.app)
                .post(`/api/notebooks/${nb1}/users/`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .send({
                username: localUserName,
                role: 'user',
                addrole: false,
            })
                .expect({ status: 'success' })
                .expect(200);
        }
        else {
            throw new Error('could not make test notebooks');
        }
    }));
    it('fails to update notebook roles', () => __awaiter(void 0, void 0, void 0, function* () {
        // make some notebooks
        const nb1 = yield (0, notebooks_1.createNotebook)('NB1', uispec, {});
        if (nb1) {
            // invalid notebook name
            yield (0, supertest_1.default)(routes_1.app)
                .post('/api/notebooks/invalid-notebook/users/')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .send({
                username: localUserName,
                role: 'user',
                addrole: true,
            })
                .expect({ error: 'Unknown notebook', status: 'error' })
                .expect(404);
            // invalid role name
            yield (0, supertest_1.default)(routes_1.app)
                .post(`/api/notebooks/${nb1}/users/`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .send({
                username: localUserName,
                role: 'not a valid role',
                addrole: true,
            })
                .expect({ error: 'Unknown role', status: 'error' })
                .expect(404);
            // invalid user name
            yield (0, supertest_1.default)(routes_1.app)
                .post(`/api/notebooks/${nb1}/users/`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .send({
                username: 'fred dag',
                role: 'user',
                addrole: true,
            })
                .expect({ error: 'Unknown user fred dag', status: 'error' })
                .expect(404);
            const bobby = yield (0, users_1.getUserFromEmailOrUsername)(localUserName);
            if (bobby) {
                const signing_key = yield (0, signing_keys_1.getSigningKey)();
                const bobbyToken = yield (0, create_1.createAuthKey)(bobby, signing_key);
                // invalid user name
                yield (0, supertest_1.default)(routes_1.app)
                    .post(`/api/notebooks/${nb1}/users/`)
                    .set('Authorization', `Bearer ${bobbyToken}`)
                    .set('Content-Type', 'application/json')
                    .send({
                    username: localUserName,
                    role: 'user',
                    addrole: true,
                })
                    .expect({
                    error: 'you do not have permission to modify users for this notebook',
                    status: 'error',
                })
                    .expect(401);
            }
        }
        else {
            throw new Error('could not make test notebooks');
        }
    }));
    it('can download records as json', () => __awaiter(void 0, void 0, void 0, function* () {
        // pull in some test data
        yield (0, backupRestore_1.restoreFromBackup)('test/backup.jsonl');
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            const notebooks = yield (0, notebooks_1.getNotebooks)(adminUser);
            (0, chai_1.expect)(notebooks).to.have.lengthOf(2);
            yield (0, supertest_1.default)(routes_1.app)
                .get('/api/notebooks/1693291182736-campus-survey-demo/records/')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .expect(200)
                .expect('Content-Type', 'application/json; charset=utf-8');
        }
    }));
    it('can download records as csv', () => __awaiter(void 0, void 0, void 0, function* () {
        // pull in some test data
        yield (0, backupRestore_1.restoreFromBackup)('test/backup.jsonl');
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            const notebooks = yield (0, notebooks_1.getNotebooks)(adminUser);
            (0, chai_1.expect)(notebooks).to.have.lengthOf(2);
            yield (0, supertest_1.default)(routes_1.app)
                .get('/api/notebooks/1693291182736-campus-survey-demo/FORM2.csv')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Content-Type', 'application/json')
                .expect(200)
                .expect('Content-Type', 'text/csv')
                .expect(response => {
                // response body should be csv data
                (0, chai_1.expect)(response.text).to.contain('identifier');
                const lines = response.text.split('\n');
                lines.forEach(line => {
                    if (line !== '' && !line.startsWith('identifier')) {
                        (0, chai_1.expect)(line).to.contain('rec');
                        (0, chai_1.expect)(line).to.contain('FORM2');
                        (0, chai_1.expect)(line).to.contain('frev');
                    }
                });
                // one more newline than the number of records + header
                (0, chai_1.expect)(lines).to.have.lengthOf(19);
            });
        }
    }));
    it('can download files as zip', () => __awaiter(void 0, void 0, void 0, function* () {
        // pull in some test data
        yield (0, backupRestore_1.restoreFromBackup)('test/backup.jsonl');
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            const notebooks = yield (0, notebooks_1.getNotebooks)(adminUser);
            (0, chai_1.expect)(notebooks).to.have.lengthOf(2);
            yield (0, supertest_1.default)(routes_1.app)
                .get('/api/notebooks/1693291182736-campus-survey-demo/FORM2.zip')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .expect('Content-Type', 'application/zip')
                .expect(response => {
                const zipContent = response.text;
                // check for _1 filename which should be there because of
                // a clash of names
                (0, chai_1.expect)(zipContent).to.contain('take-photo/DuplicateHRID-take-photo_1.png');
            });
        }
    }));
    if (buildconfig_1.DEVELOPER_MODE) {
        it('can create some random records', () => __awaiter(void 0, void 0, void 0, function* () {
            const nb1 = yield (0, notebooks_1.createNotebook)('NB1', uispec, {});
            if (nb1) {
                return (0, supertest_1.default)(routes_1.app)
                    .post(`/api/notebooks/${nb1}/generate`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .set('Content-Type', 'application/json')
                    .send({ count: 10 })
                    .expect(200);
            }
            else {
                throw new Error('could not make test notebook');
            }
        }));
    }
});
