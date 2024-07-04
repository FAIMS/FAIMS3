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
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pouchdb_1 = __importDefault(require("pouchdb"));
const pouchdb_find_1 = __importDefault(require("pouchdb-find"));
const buildconfig_1 = require("./buildconfig");
const routes_1 = require("./routes");
const faims3_datamodel_1 = require("faims3-datamodel");
const couchdb_1 = require("./couchdb");
const notebooks_1 = require("./couchdb/notebooks");
// set up the database module faims3-datamodel with our callbacks to get databases
(0, faims3_datamodel_1.registerClient)({
    getDataDB: couchdb_1.getProjectDataDB,
    getProjectDB: couchdb_1.getProjectMetaDB,
    shouldDisplayRecord: () => true,
});
process.on('unhandledRejection', error => {
    console.error('unhandledRejection');
    console.error(error); // This prints error with stack included (as for normal errors)
    // don't re-throw the error since we don't want to crash the server
});
pouchdb_1.default.plugin(pouchdb_find_1.default);
// on startup, run a validation of the databases that can perform
// any required migrations
(0, notebooks_1.validateDatabases)();
routes_1.app.listen(buildconfig_1.CONDUCTOR_INTERNAL_PORT, '0.0.0.0', () => {
    console.log(`Conductor is listening on port http://0.0.0.0:${buildconfig_1.CONDUCTOR_INTERNAL_PORT}/`);
});
