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
 * Filename: devtools.tests.ts
 * Description:
 *   Tests for the devtools module
 */
const pouchdb_1 = __importDefault(require("pouchdb"));
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const couchdb_1 = require("../src/couchdb");
const notebooks_1 = require("../src/couchdb/notebooks");
const fs = __importStar(require("fs"));
const devtools_1 = require("../src/couchdb/devtools");
const faims3_datamodel_1 = require("faims3-datamodel");
const buildconfig_1 = require("../src/buildconfig");
const chai_1 = require("chai");
const mocks_1 = require("./mocks");
// set up the database module faims3-datamodel with our callbacks to get databases
(0, faims3_datamodel_1.registerClient)(mocks_1.callbackObject);
if (buildconfig_1.DEVELOPER_MODE) {
    it('createRecords', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, couchdb_1.initialiseDatabases)();
        const jsonText = fs.readFileSync('./notebooks/sample_notebook.json', 'utf-8');
        const { metadata, 'ui-specification': uiSpec } = JSON.parse(jsonText);
        const projectID = yield (0, notebooks_1.createNotebook)('Test Notebook', uiSpec, metadata);
        (0, chai_1.expect)(projectID).not.to.be.undefined;
        if (projectID) {
            yield (0, devtools_1.createRandomRecord)(projectID);
        }
    }));
}
else {
    it('dummy test since we must have at least one test', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, chai_1.expect)(true).to.be.true;
    }));
}
