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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreFromBackup = void 0;
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
 * Filename: backupRestore.ts
 * Description:
 *    Functions to backup and restore databases
 */
const promises_1 = require("node:fs/promises");
const _1 = require(".");
const faims3_datamodel_1 = require("faims3-datamodel");
/**
 * restoreFromBackup - restore databases from a JSONL backup file
 * Backup file contains one line per document from the database
 * Each database starts with a JSONL line with the key `type="header"`
 * @param filename file containing JSONL backup of databases
 */
const restoreFromBackup = (filename) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const file = yield (0, promises_1.open)(filename);
    let dbName;
    let db;
    try {
        for (var _d = true, _e = __asyncValues(file.readLines()), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
            _c = _f.value;
            _d = false;
            try {
                const line = _c;
                const doc = JSON.parse(line);
                if (doc.type === 'header') {
                    dbName = doc.database;
                    if (dbName.startsWith('projects')) {
                        // name will be eg. 'projects_default', where 'default' is the
                        // conductor instance id
                        // we'll put all projects into our projectsDB
                        db = yield (0, _1.getProjectsDB)();
                    }
                    else if (dbName.startsWith('metadata')) {
                        const projectName = dbName.split('||')[1];
                        db = yield (0, faims3_datamodel_1.getProjectDB)(projectName);
                    }
                    else if (dbName.startsWith('data')) {
                        const projectName = dbName.split('||')[1];
                        db = yield (0, faims3_datamodel_1.getDataDB)(projectName);
                        if (db) {
                            (0, faims3_datamodel_1.addDesignDocsForNotebook)(db);
                            // TODO: set up permissions for the databases
                        }
                    }
                    else {
                        // don't try to restore anything we don't know about
                        db = undefined;
                    }
                }
                else if (!doc.id.startsWith('_design') && db) {
                    // don't try to restore design documents as these will have been
                    // created on the database initialisation
                    // delete the _rev attribute so that we can put it into an empty db
                    // if we were restoring into an existing db, we would need to be more
                    // careful and check whether this _rev is present in the db already
                    delete doc.doc._rev;
                    try {
                        yield db.put(doc.doc);
                    }
                    catch (error) {
                        console.log('Error restoring document', doc.id, error);
                    }
                }
            }
            finally {
                _d = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
exports.restoreFromBackup = restoreFromBackup;
