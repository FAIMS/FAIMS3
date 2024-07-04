"use strict";
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
 * Filename: couchdb.tests.ts
 * Description:
 *   Tests for the interface to couchDB
 */
const pouchdb_1 = __importDefault(require("pouchdb"));
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const couchdb_1 = require("../src/couchdb");
const notebooks_1 = require("../src/couchdb/notebooks");
const fs = __importStar(require("fs"));
const users_1 = require("../src/couchdb/users");
const buildconfig_1 = require("../src/buildconfig");
const faims3_datamodel_1 = require("faims3-datamodel");
const chai_1 = require("chai");
const mocks_1 = require("./mocks");
const assert_1 = require("assert");
const uispec = {
    fields: [],
    views: {},
    viewsets: {},
    visible_types: [],
};
const username = 'bobalooba';
let bobalooba;
describe('notebook api', () => {
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, mocks_1.resetDatabases)();
        const adminUser = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        if (adminUser) {
            const [user, error] = yield (0, users_1.createUser)('', username);
            if (user) {
                yield (0, users_1.saveUser)(user);
                bobalooba = user;
            }
            else {
                throw new Error(error);
            }
        }
    }));
    it('check initialise', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const directoryDB = (0, couchdb_1.getDirectoryDB)();
        (0, chai_1.expect)(directoryDB).not.to.equal(undefined);
        if (directoryDB) {
            const default_document = (yield directoryDB.get('default'));
            (0, chai_1.expect)(default_document.name).to.equal(buildconfig_1.CONDUCTOR_INSTANCE_NAME);
            const permissions_document = (yield directoryDB.get('_design/permissions'));
            (0, chai_1.expect)(permissions_document['_id']).to.equal('_design/permissions');
        }
    }));
    it('project roles', () => __awaiter(void 0, void 0, void 0, function* () {
        // make some notebooks
        const nb1 = yield (0, notebooks_1.createNotebook)('NB1', uispec, {});
        const nb2 = yield (0, notebooks_1.createNotebook)('NB2', uispec, {});
        if (nb1 && nb2) {
            // give user access to two of them
            (0, users_1.addProjectRoleToUser)(bobalooba, nb1, 'user');
            (0, chai_1.expect)((0, users_1.userHasPermission)(bobalooba, nb1, 'read')).to.equal(true);
            (0, users_1.addProjectRoleToUser)(bobalooba, nb2, 'admin');
            (0, chai_1.expect)((0, users_1.userHasPermission)(bobalooba, nb2, 'modify')).to.equal(true);
            // and this should still be true
            (0, chai_1.expect)((0, users_1.userHasPermission)(bobalooba, nb1, 'read')).to.equal(true);
            (0, users_1.removeProjectRoleFromUser)(bobalooba, nb1, 'user');
            (0, chai_1.expect)((0, users_1.userHasPermission)(bobalooba, nb1, 'read')).to.equal(false);
            // but still...
            (0, chai_1.expect)((0, users_1.userHasPermission)(bobalooba, nb2, 'modify')).to.equal(true);
        }
    }));
    it('getNotebooks', () => __awaiter(void 0, void 0, void 0, function* () {
        // make some notebooks
        const nb1 = yield (0, notebooks_1.createNotebook)('NB1', uispec, {});
        const nb2 = yield (0, notebooks_1.createNotebook)('NB2', uispec, {});
        const nb3 = yield (0, notebooks_1.createNotebook)('NB3', uispec, {});
        const nb4 = yield (0, notebooks_1.createNotebook)('NB4', uispec, {});
        if (nb1 && nb2 && nb3 && nb4) {
            // give user access to two of them
            (0, users_1.addProjectRoleToUser)(bobalooba, nb1, 'user');
            (0, users_1.addProjectRoleToUser)(bobalooba, nb2, 'user');
            yield (0, users_1.saveUser)(bobalooba);
            const notebooks = yield (0, notebooks_1.getNotebooks)(bobalooba);
            (0, chai_1.expect)(notebooks.length).to.equal(2);
        }
        else {
            throw new Error('could not make test notebooks');
        }
    }));
    it('can create a notebook', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const user = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const projectID = yield (0, notebooks_1.createNotebook)(' Test   Nõtebõõk', uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        (0, chai_1.expect)(user).not.to.be.null;
        if (projectID && user) {
            (0, chai_1.expect)(projectID.substring(13)).to.equal('-test-notebook');
            const notebooks = yield (0, notebooks_1.getNotebooks)(user);
            (0, chai_1.expect)(notebooks.length).to.equal(1);
            const db = yield (0, faims3_datamodel_1.getProjectDB)(projectID);
            if (db) {
                try {
                    const autoInc = (yield db.get('local-autoincrementers'));
                    (0, chai_1.expect)(autoInc.references.length).to.equal(2);
                    (0, chai_1.expect)(autoInc.references[0].form_id).to.equal('FORM1SECTION1');
                }
                catch (err) {
                    (0, assert_1.fail)('could not get autoincrementers');
                }
            }
        }
    }));
    it('getNotebookMetadata', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const name = 'Test Notebook';
        const projectID = yield (0, notebooks_1.createNotebook)(name, uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        if (projectID) {
            const retrievedMetadata = yield (0, notebooks_1.getNotebookMetadata)(projectID);
            (0, chai_1.expect)(retrievedMetadata).not.to.be.null;
            if (retrievedMetadata) {
                (0, chai_1.expect)(retrievedMetadata['lead_institution']).to.equal(metadata['lead_institution']);
                (0, chai_1.expect)(retrievedMetadata['name']).to.equal(name);
            }
        }
    }));
    it('can validate a notebook id', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const name = 'Test Notebook';
        const projectID = yield (0, notebooks_1.createNotebook)(name, uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        if (projectID) {
            const valid = yield (0, notebooks_1.validateNotebookID)(projectID);
            (0, chai_1.expect)(valid).to.be.true;
            const invalid = yield (0, notebooks_1.validateNotebookID)('invalid');
            (0, chai_1.expect)(invalid).to.be.false;
        }
    }));
    it('getNotebookUISpec', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const name = 'Test Notebook';
        const projectID = yield (0, notebooks_1.createNotebook)(name, uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        if (projectID) {
            const retrieved = yield (0, notebooks_1.getNotebookUISpec)(projectID);
            (0, chai_1.expect)(retrieved).not.to.be.null;
            if (retrieved) {
                (0, chai_1.expect)(retrieved['fviews'].length).to.equal(uiSpec.fviews.length);
                (0, chai_1.expect)(retrieved['fields']).not.to.equal(undefined);
            }
        }
    }));
    it('get notebook roles', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const name = 'Test Notebook';
        const projectID = yield (0, notebooks_1.createNotebook)(name, uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        if (projectID) {
            const roles = yield (0, notebooks_1.getRolesForNotebook)(projectID);
            (0, chai_1.expect)(roles.length).to.equal(4);
            (0, chai_1.expect)(roles).to.include('admin'); // admin role should always be present
            (0, chai_1.expect)(roles).to.include('team'); // specified in the UISpec
            (0, chai_1.expect)(roles).to.include('moderator'); // specified in the UISpec
            (0, chai_1.expect)(roles).to.include('user'); // user role should always be present
        }
    }));
    it('updateNotebook', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const user = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const projectID = yield (0, notebooks_1.createNotebook)(' Test   Nõtebõõk', uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.equal(undefined);
        (0, chai_1.expect)(user).not.to.be.null;
        if (projectID && user) {
            // now update it with a minor change
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
            // now update the notebook
            const newProjectID = yield (0, notebooks_1.updateNotebook)(projectID, uiSpec, metadata);
            (0, chai_1.expect)(newProjectID).to.equal(projectID);
            (0, chai_1.expect)(projectID.substring(13)).to.equal('-test-notebook');
            const notebooks = yield (0, notebooks_1.getNotebooks)(user);
            (0, chai_1.expect)(notebooks.length).to.equal(1);
            const db = yield (0, faims3_datamodel_1.getProjectDB)(projectID);
            if (db) {
                const newUISpec = yield (0, notebooks_1.getNotebookUISpec)(projectID);
                if (newUISpec) {
                    (0, chai_1.expect)(newUISpec['fviews']['FORM1SECTION1']['label']).to.equal('Updated Label');
                }
                const newMetadata = yield (0, notebooks_1.getNotebookMetadata)(projectID);
                if (newMetadata) {
                    (0, chai_1.expect)(newMetadata['name']).to.equal('Updated Test Notebook');
                    (0, chai_1.expect)(newMetadata['project_lead']).to.equal('Bob Bobalooba');
                }
                const metaDB = yield (0, faims3_datamodel_1.getProjectDB)(projectID);
                if (metaDB) {
                    const autoInc = (yield metaDB.get('local-autoincrementers'));
                    (0, chai_1.expect)(autoInc.references.length).to.equal(3);
                }
            }
        }
    }));
});
