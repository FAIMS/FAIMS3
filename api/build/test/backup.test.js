"use strict";
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
const backupRestore_1 = require("../src/couchdb/backupRestore");
const notebooks_1 = require("../src/couchdb/notebooks");
const faims3_datamodel_1 = require("faims3-datamodel");
const users_1 = require("../src/couchdb/users");
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const chai_1 = require("chai");
const mocks_1 = require("./mocks");
// register our mock database clients with the module
(0, faims3_datamodel_1.registerClient)(mocks_1.callbackObject);
describe('Backup and restore', () => {
    it('restore backup', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, mocks_1.resetDatabases)();
        yield (0, mocks_1.cleanDataDBS)();
        yield (0, backupRestore_1.restoreFromBackup)('test/backup.jsonl');
        // should now have the notebooks from the backup defined
        const user = yield (0, users_1.getUserFromEmailOrUsername)('admin');
        (0, chai_1.expect)(user).not.to.be.undefined;
        if (user) {
            const notebooks = yield (0, notebooks_1.getNotebooks)(user);
            (0, chai_1.expect)(notebooks.length).to.equal(2);
            (0, chai_1.expect)(notebooks[0].name).to.equal('Campus Survey Demo');
            // test record iterator while we're here
            const iterator = yield (0, faims3_datamodel_1.notebookRecordIterator)(notebooks[0].non_unique_project_id, 'FORM2');
            let count = 0;
            let { record, done } = yield iterator.next();
            while (record && !done) {
                count += 1;
                ({ record, done } = yield iterator.next());
            }
            (0, chai_1.expect)(count).to.equal(17);
            // throw in a test of getNotebookRecords while we're here
            const records = yield (0, notebooks_1.getNotebookRecords)(notebooks[0].non_unique_project_id);
            (0, chai_1.expect)(records).to.have.lengthOf(28);
        }
    }));
});
