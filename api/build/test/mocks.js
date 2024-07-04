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
exports.callbackObject = exports.cleanDataDBS = exports.resetDatabases = void 0;
const pouchdb_1 = __importDefault(require("pouchdb"));
// eslint-disable-next-line node/no-unpublished-require
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
const couchdb_1 = require("../src/couchdb");
const buildconfig_1 = require("../src/buildconfig");
const databaseList = {};
const getDatabase = (databaseName) => __awaiter(void 0, void 0, void 0, function* () {
    if (databaseList[databaseName] === undefined) {
        // still use the COUCHDB URL setting to be consistent with
        // other bits of the code, but this database will be in memory
        const db = new pouchdb_1.default(buildconfig_1.COUCHDB_INTERNAL_URL + '/' + databaseName, {
            adapter: 'memory',
        });
        databaseList[databaseName] = db;
    }
    return databaseList[databaseName];
});
const mockGetDataDB = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    const databaseName = 'data-' + project_id;
    return getDatabase(databaseName);
});
const mockGetProjectDB = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    return getDatabase('metadatadb-' + project_id);
});
const mockShouldDisplayRecord = () => {
    return true;
};
const clearDB = (db) => __awaiter(void 0, void 0, void 0, function* () {
    const docs = yield db.allDocs();
    for (let index = 0; index < docs.rows.length; index++) {
        const doc = docs.rows[index];
        yield db.remove(doc.id, doc.value.rev);
    }
});
const resetDatabases = () => __awaiter(void 0, void 0, void 0, function* () {
    const usersDB = (0, couchdb_1.getUsersDB)();
    if (usersDB) {
        yield clearDB(usersDB);
    }
    const projectsDB = (0, couchdb_1.getProjectsDB)();
    if (projectsDB) {
        yield clearDB(projectsDB);
    }
    yield (0, couchdb_1.initialiseDatabases)();
});
exports.resetDatabases = resetDatabases;
const cleanDataDBS = () => __awaiter(void 0, void 0, void 0, function* () {
    let db;
    for (const name in databaseList) {
        db = databaseList[name];
        delete databaseList[name];
        if (db !== undefined) {
            try {
                yield db.destroy();
                //await db.close();
            }
            catch (err) {
                //console.error(err);
            }
        }
    }
});
exports.cleanDataDBS = cleanDataDBS;
// register our mock database clients with the module
exports.callbackObject = {
    getDataDB: mockGetDataDB,
    getProjectDB: mockGetProjectDB,
    shouldDisplayRecord: mockShouldDisplayRecord,
};
