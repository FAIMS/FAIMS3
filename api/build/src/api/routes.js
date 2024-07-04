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
 * Filename: routes.ts
 * Description:
 *   This module contains the route definitions for the conductor api
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
exports.api = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const notebooks_1 = require("../couchdb/notebooks");
const middleware_1 = require("../middleware");
const couchdb_1 = require("../couchdb");
const users_1 = require("../couchdb/users");
const buildconfig_1 = require("../buildconfig");
const devtools_1 = require("../couchdb/devtools");
const backupRestore_1 = require("../couchdb/backupRestore");
// TODO: configure this directory
const upload = (0, multer_1.default)({ dest: '/tmp/' });
exports.api = express_1.default.Router();
exports.api.get('/hello/', middleware_1.requireAuthenticationAPI, (_req, res) => {
    res.send({ message: 'hello from the api!' });
});
/**
 * POST to /api/initialise does initialisation on the databases
 * - this does not have any auth requirement because it should be used
 *   to set up the users database and create the admin user
 *   if databases exist, this is a no-op
 */
exports.api.post('/initialise/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    (0, couchdb_1.initialiseDatabases)();
    res.json({ success: true });
}));
exports.api.get('/directory/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // get the directory of notebooks on this server
    if (req.user) {
        const projects = yield (0, notebooks_1.getProjects)(req.user);
        res.json(projects);
    }
    else {
        res.json([]);
    }
}));
exports.api.get('/notebooks/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // get a list of notebooks from the db
    if (req.user) {
        const notebooks = yield (0, notebooks_1.getNotebooks)(req.user);
        res.json(notebooks);
    }
    else {
        res.json([]);
    }
}));
/**
 * POST to /notebooks/ to create a new notebook
 */
exports.api.post('/notebooks/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user && (0, users_1.userCanCreateNotebooks)(req.user)) {
        const uiSpec = req.body['ui-specification'];
        const projectName = req.body.name;
        const metadata = req.body.metadata;
        try {
            const projectID = yield (0, notebooks_1.createNotebook)(projectName, uiSpec, metadata);
            if (projectID) {
                // allow this user to modify the new notebook
                (0, users_1.addProjectRoleToUser)(req.user, projectID, 'admin');
                yield (0, users_1.saveUser)(req.user);
                res.json({ notebook: projectID });
            }
            else {
                res.json({ error: 'error creating the notebook' });
                res.status(500).end();
            }
        }
        catch (err) {
            res.json({ error: 'there was an error creating the notebook' });
            res.status(500).end();
        }
    }
    else {
        res.json({
            error: 'you do not have permission to create notebooks on this server',
        });
        res.status(401).end();
    }
}));
exports.api.get('/notebooks/:id', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // get full details of a single notebook
    const project_id = req.params.id;
    if (req.user && (0, users_1.userHasPermission)(req.user, project_id, 'read')) {
        const metadata = yield (0, notebooks_1.getNotebookMetadata)(project_id);
        const uiSpec = yield (0, notebooks_1.getNotebookUISpec)(project_id);
        if (metadata && uiSpec) {
            res.json({ metadata, 'ui-specification': uiSpec });
        }
        else {
            res.json({ error: 'not found' });
            res.status(404).end();
        }
    }
    else {
        // unauthorised response
        res.status(401).end();
    }
}));
// PUT a new version of a notebook
exports.api.put('/notebooks/:id', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // user must have modify permissions on this notebook
    if ((0, users_1.userHasPermission)(req.user, req.params.id, 'modify')) {
        const uiSpec = req.body['ui-specification'];
        const metadata = req.body.metadata;
        const projectID = req.params.id;
        try {
            yield (0, notebooks_1.updateNotebook)(projectID, uiSpec, metadata);
            res.json({ notebook: projectID });
        }
        catch (err) {
            res.json({ error: 'there was an error creating the notebook' });
            console.log('Error creating notebook', err);
            res.status(500).end();
        }
    }
    else {
        res.json({
            error: 'you do not have permission to modify this notebook',
        });
        res.status(401).end();
    }
}));
// export current versions of all records in this notebook
exports.api.get('/notebooks/:id/records/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let records = [];
    if (req.user && (0, users_1.userHasPermission)(req.user, req.params.id, 'read')) {
        records = yield (0, notebooks_1.getNotebookRecords)(req.params.id);
    }
    if (records) {
        res.json({ records });
    }
    else {
        res.json({ error: 'notebook not found' });
        res.status(404).end();
    }
}));
// export current versions of all records in this notebook as csv
exports.api.get('/notebooks/:id/:viewID.csv', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user && (0, users_1.userHasPermission)(req.user, req.params.id, 'read')) {
        try {
            res.setHeader('Content-Type', 'text/csv');
            (0, notebooks_1.streamNotebookRecordsAsCSV)(req.params.id, req.params.viewID, res);
        }
        catch (err) {
            console.log('Error streaming CSV', err);
            res.json({ error: 'error creating CSV' });
            res.status(500).end();
        }
    }
    else {
        res.json({ error: 'notebook not found' });
        res.status(404).end();
    }
}));
// export files for all records in this notebook as zip
exports.api.get('/notebooks/:id/:viewid.zip', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user && (0, users_1.userHasPermission)(req.user, req.params.id, 'read')) {
        res.setHeader('Content-Type', 'application/zip');
        (0, notebooks_1.streamNotebookFilesAsZip)(req.params.id, req.params.viewid, res);
    }
    else {
        res.json({ error: 'notebook not found' });
        res.status(404).end();
    }
}));
exports.api.get('/notebooks/:id/users/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // user must have admin access tot his notebook
    if ((0, users_1.userHasPermission)(req.user, req.params.id, 'modify')) {
        const userInfo = yield (0, users_1.getUserInfoForNotebook)(req.params.id);
        res.json(userInfo);
    }
    else {
        res.json({
            error: 'you do not have permission to view users for this notebook',
        });
        res.status(401).end();
    }
}));
// POST to give a user permissions on this notebook
// body includes:
//   {
//     username: 'a username or email',
//     role: a valid role for this notebook,
//     addrole: boolean, true to add, false to delete
//   }
exports.api.post('/notebooks/:id/users/', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, users_1.userHasPermission)(req.user, req.params.id, 'modify')) {
        let error = '';
        const notebook = yield (0, notebooks_1.getNotebookMetadata)(req.params.id);
        if (notebook) {
            const username = req.body.username;
            const role = req.body.role;
            const addrole = req.body.addrole;
            // check that this is a legitimate role for this notebook
            const notebookRoles = yield (0, notebooks_1.getRolesForNotebook)(notebook.project_id);
            if (notebookRoles.indexOf(role) >= 0) {
                const user = yield (0, users_1.getUserFromEmailOrUsername)(username);
                if (user) {
                    if (addrole) {
                        yield (0, users_1.addProjectRoleToUser)(user, notebook.project_id, role);
                    }
                    else {
                        yield (0, users_1.removeProjectRoleFromUser)(user, notebook.project_id, role);
                    }
                    yield (0, users_1.saveUser)(user);
                    res.json({ status: 'success' });
                    return;
                }
                else {
                    error = 'Unknown user ' + username;
                }
            }
            else {
                error = 'Unknown role';
            }
        }
        else {
            error = 'Unknown notebook';
        }
        // user or project not found or bad role
        res.status(404);
        res.json({ status: 'error', error }).end();
    }
    else {
        res.status(401);
        res
            .json({
            status: 'error',
            error: 'you do not have permission to modify users for this notebook',
        })
            .end();
    }
}));
// update a user
exports.api.post('/users/:id/admin', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, users_1.userIsClusterAdmin)(req.user)) {
        let error = '';
        const username = req.params.id;
        const addrole = req.body.addrole;
        const role = req.body.role;
        console.log('addrole', addrole, 'role', role, buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME);
        const user = yield (0, users_1.getUserFromEmailOrUsername)(username);
        if (user) {
            if (role === buildconfig_1.CLUSTER_ADMIN_GROUP_NAME ||
                role === buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME) {
                if (addrole) {
                    yield (0, users_1.addOtherRoleToUser)(user, role);
                }
                else {
                    yield (0, users_1.removeOtherRoleFromUser)(user, role);
                }
                yield (0, users_1.saveUser)(user);
                res.json({ status: 'success' });
                return;
            }
            else {
                error = 'Unknown role';
            }
        }
        else {
            error = 'Unknown user ' + username;
        }
        // user or project not found or bad role
        res.status(404).json({ status: 'error', error }).end();
    }
    else {
        res
            .status(401)
            .json({
            error: 'you do not have permission to modify user permissions for this server',
        })
            .end();
    }
}));
exports.api.post('/notebooks/:notebook_id/delete', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, users_1.userIsClusterAdmin)(req.user)) {
        const project_id = req.params.notebook_id;
        const notebook = yield (0, notebooks_1.getNotebookMetadata)(project_id);
        if (notebook) {
            yield (0, notebooks_1.deleteNotebook)(project_id);
            res.redirect('/notebooks/');
        }
        else {
            res.status(404).end();
        }
    }
    else {
        res.status(401).end();
    }
}));
if (buildconfig_1.DEVELOPER_MODE) {
    exports.api.post('/restore', upload.single('backup'), middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if ((0, users_1.userIsClusterAdmin)(req.user)) {
            yield (0, backupRestore_1.restoreFromBackup)(req.file.path);
            res.json({ status: 'success' });
        }
        else {
            res.status(401).end();
        }
    }));
    exports.api.post('/notebooks/:notebook_id/generate', middleware_1.requireAuthenticationAPI, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if ((0, users_1.userIsClusterAdmin)(req.user)) {
            const project_id = req.params.notebook_id;
            const count = req.body.count || 1;
            const record_ids = yield (0, devtools_1.createManyRandomRecords)(project_id, count);
            res.json({ record_ids });
            res.status(200).end();
        }
        else {
            res.status(401).end();
        }
    }));
}
