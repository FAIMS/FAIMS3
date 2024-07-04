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
 *   This module provides functions to access notebooks from the database
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
exports.countRecordsInNotebook = exports.getRolesForNotebook = exports.streamNotebookFilesAsZip = exports.streamNotebookRecordsAsCSV = exports.getNotebookFields = exports.getNotebookRecords = exports.validateNotebookID = exports.getNotebookUISpec = exports.getNotebookMetadata = exports.writeProjectMetadata = exports.deleteNotebook = exports.updateNotebook = exports.createNotebook = exports.validateDatabases = exports.getNotebooks = exports.getProjects = void 0;
const pouchdb_1 = __importDefault(require("pouchdb"));
const _1 = require(".");
const buildconfig_1 = require("../buildconfig");
const faims3_datamodel_1 = require("faims3-datamodel");
const database_1 = require("../datamodel/database");
const archiver_1 = __importDefault(require("archiver"));
const stream_1 = require("stream");
const pouchdb_security_helper_1 = __importDefault(require("pouchdb-security-helper"));
const faims3_datamodel_2 = require("faims3-datamodel");
const users_1 = require("./users");
pouchdb_1.default.plugin(pouchdb_security_helper_1.default);
const csv_stringify_1 = require("csv-stringify");
/**
 * getProjects - get the internal project documents that reference
 * the project databases that the front end will connnect to
 * @param user - only return projects visible to this user
 */
const getProjects = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const projects = [];
    const projects_db = (0, _1.getProjectsDB)();
    if (projects_db) {
        const res = yield projects_db.allDocs({
            include_docs: true,
        });
        res.rows.forEach(e => {
            if (e.doc !== undefined && !e.id.startsWith('_')) {
                const doc = e.doc;
                if ((0, users_1.userHasPermission)(user, e.id, 'read')) {
                    delete doc._rev;
                    const project = doc;
                    // add database connection details
                    if (project.metadata_db)
                        project.metadata_db.base_url = buildconfig_1.COUCHDB_PUBLIC_URL;
                    if (project.data_db)
                        project.data_db.base_url = buildconfig_1.COUCHDB_PUBLIC_URL;
                    projects.push(project);
                }
            }
        });
    }
    return projects;
});
exports.getProjects = getProjects;
/**
 * getNotebooks -- return an array of notebooks from the database
 * @oaram user - only return notebooks that this user can see
 * @returns an array of ProjectObject objects
 */
const getNotebooks = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const projects = [];
    // in the frontend, the listing_id names the backend instance,
    // so far it's either 'default' or 'locallycreatedproject'
    const listing_id = 'default';
    const projects_db = (0, _1.getProjectsDB)();
    if (projects_db) {
        const res = yield projects_db.allDocs({
            include_docs: true,
        });
        res.rows.forEach(e => {
            if (e.doc !== undefined && !e.id.startsWith('_')) {
                projects.push(e.doc);
            }
        });
        for (const project of projects) {
            const project_id = project._id;
            const full_project_id = (0, faims3_datamodel_1.resolve_project_id)(listing_id, project_id);
            const projectMeta = yield (0, exports.getNotebookMetadata)(project_id);
            if ((0, users_1.userHasPermission)(user, project_id, 'read')) {
                output.push({
                    name: project.name,
                    last_updated: project.last_updated,
                    created: project.created,
                    status: project.status,
                    project_id: full_project_id,
                    listing_id: listing_id,
                    non_unique_project_id: project_id,
                    metadata: projectMeta,
                });
            }
        }
    }
    return output;
});
exports.getNotebooks = getNotebooks;
/**
 * Slugify a string, replacing special characters with less special ones
 * @param str input string
 * @returns url safe version of the string
 * https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
const slugify = (str) => {
    str = str.trim();
    str = str.toLowerCase();
    // remove accents, swap ñ for n, etc
    const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
    const to = 'aaaaaeeeeeiiiiooooouuuunc------';
    for (let i = 0, l = from.length; i < l; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }
    str = str
        .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes
    return str;
};
/**
 * Generate a good project identifier for a new project
 * @param projectName the project name string
 * @returns a suitable project identifier
 */
const generateProjectID = (projectName) => {
    return `${Date.now().toFixed()}-${slugify(projectName)}`;
};
/**
 * Derive an autoincrementers object from a UI Spec
 *   find all of the autoincrement fields in the UISpec and create an
 *   entry for each of them.
 * @param uiSpec a project UI Model
 * @returns an autoincrementers object suitable for insertion into the db or
 *          undefined if there are no such fields
 */
const getAutoIncrementers = (uiSpec) => {
    // Note that this relies on the name 'local-autoincrementers' being the same as that
    // used in the front-end code (LOCAL_AUTOINCREMENTERS_NAME in src/local-data/autoincrementers.ts)
    const autoinc = {
        _id: 'local-autoincrementers',
        references: [],
    };
    const fields = uiSpec.fields;
    for (const field in fields) {
        // TODO are there other names?
        if (fields[field]['component-name'] === 'BasicAutoIncrementer') {
            autoinc.references.push({
                form_id: fields[field]['component-parameters'].form_id,
                field_id: fields[field]['component-parameters'].name,
                label: fields[field]['component-parameters'].label,
            });
        }
    }
    if (autoinc.references.length > 0) {
        return autoinc;
    }
    else {
        return undefined;
    }
};
/**
 * validateDatabases - check that all notebook databases are set up
 *  properly, add design documents if they are missing
 */
const validateDatabases = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const projects = [];
    const projects_db = (0, _1.getProjectsDB)();
    if (projects_db) {
        const res = yield projects_db.allDocs({
            include_docs: true,
        });
        res.rows.forEach(e => {
            if (e.doc !== undefined && !e.id.startsWith('_')) {
                projects.push(e.doc);
            }
        });
        for (const project of projects) {
            const project_id = project._id;
            const dataDB = yield (0, faims3_datamodel_2.getDataDB)(project_id);
            // ensure that design documents are here
            yield (0, faims3_datamodel_1.addDesignDocsForNotebook)(dataDB);
        }
    }
    return output;
});
exports.validateDatabases = validateDatabases;
/**
 * Create notebook databases and initialise them with required contents
 *
 * @param projectName Human readable project name
 * @param uispec A project Ui Specification
 * @param metadata A metadata object with properties/values
 * @returns the project id
 */
const createNotebook = (projectName, uispec, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    const project_id = generateProjectID(projectName);
    const metaDBName = `metadata-${project_id}`;
    const dataDBName = `data-${project_id}`;
    const projectDoc = {
        _id: project_id,
        name: projectName.trim(),
        metadata_db: {
            db_name: metaDBName,
        },
        data_db: {
            db_name: dataDBName,
        },
        status: 'published',
    };
    try {
        // first add an entry to the projects db about this project
        // this is used to find the other databases below
        const projectsDB = (0, _1.getProjectsDB)();
        if (projectsDB) {
            yield projectsDB.put(projectDoc);
        }
    }
    catch (error) {
        console.log('Error creating project entry in projects database:', error);
        return undefined;
    }
    const metaDB = yield (0, faims3_datamodel_1.getProjectDB)(project_id);
    if (!metaDB) {
        return undefined;
    }
    // get roles from the notebook, ensure that 'user' and 'admin' are included
    const roles = metadata.accesses || ['admin', 'user', 'team'];
    if (roles.indexOf('user') < 0) {
        roles.push('user');
    }
    if (roles.indexOf('admin') < 0) {
        roles.push('admin');
    }
    // can't save security on a memory database so skip this if we're testing
    if (process.env.NODE_ENV !== 'test') {
        const metaSecurity = yield metaDB.security();
        metaSecurity.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
        roles.forEach((role) => {
            metaSecurity.members.roles.add(`${project_id}||${role}`);
        });
        yield metaSecurity.save();
    }
    // derive autoincrementers from uispec
    const autoIncrementers = getAutoIncrementers(uispec);
    if (autoIncrementers) {
        yield metaDB.put(autoIncrementers);
    }
    uispec['_id'] = 'ui-specification';
    yield metaDB.put(uispec);
    // ensure that the name is in the metadata
    metadata.name = projectName.trim();
    yield (0, exports.writeProjectMetadata)(metaDB, metadata);
    // data database
    const dataDB = yield (0, faims3_datamodel_2.getDataDB)(project_id);
    if (!dataDB) {
        return undefined;
    }
    // can't save security on a memory database so skip this if we're testing
    if (process.env.NODE_ENV !== 'test') {
        const dataSecurity = yield dataDB.security();
        dataSecurity.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
        roles.forEach((role) => {
            dataSecurity.members.roles.add(`${project_id}||${role}`);
        });
        yield dataSecurity.save();
    }
    try {
        yield (0, faims3_datamodel_1.addDesignDocsForNotebook)(dataDB);
    }
    catch (error) {
        console.log(error);
    }
    return project_id;
});
exports.createNotebook = createNotebook;
/**
 * Update an existing notebook definition
 * @param project_id Project identifier
 * @param uispec Project UI Spec object
 * @param metadata Project Metadata
 * @returns project_id or undefined if the project doesn't exist
 */
const updateNotebook = (project_id, uispec, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    const metaDB = yield (0, faims3_datamodel_1.getProjectDB)(project_id);
    const dataDB = yield (0, faims3_datamodel_2.getDataDB)(project_id);
    if (!dataDB || !metaDB) {
        return undefined;
    }
    // get roles from the notebook, ensure that 'user' and 'admin' are included
    const roles = metadata.accesses || ['admin', 'user', 'team'];
    if (roles.indexOf('user') < 0) {
        roles.push('user');
    }
    if (roles.indexOf('admin') < 0) {
        roles.push('admin');
    }
    // can't save security on a memory database so skip this if we're testing
    if (process.env.NODE_ENV !== 'test') {
        const metaSecurity = metaDB.security();
        const dataSecurity = dataDB.security();
        if (!(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME in metaSecurity.admins.roles)) {
            metaSecurity.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
            dataSecurity.admins.roles.add(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME);
        }
        roles.forEach((role) => {
            const permission = `${project_id}||${role}`;
            if (!(permission in metaSecurity.members.roles)) {
                metaSecurity.members.roles.add(permission);
                dataSecurity.members.roles.add(permission);
            }
        });
        yield metaSecurity.save();
    }
    // derive autoincrementers from uispec
    const autoIncrementers = getAutoIncrementers(uispec);
    if (autoIncrementers) {
        // need to update any existing autoincrementer document
        // this should have the _rev property so that our update will work
        const existingAutoInc = (yield metaDB.get('local-autoincrementers'));
        if (existingAutoInc) {
            existingAutoInc.references = autoIncrementers.references;
            yield metaDB.put(existingAutoInc);
        }
        else {
            yield metaDB.put(autoIncrementers);
        }
    }
    // update the existing uispec document
    // need the revision id of the existing one to do this...
    const existingUISpec = yield metaDB.get('ui-specification');
    // set the id and rev
    uispec['_id'] = 'ui-specification';
    uispec['_rev'] = existingUISpec['_rev'];
    // now store it to update the spec
    yield metaDB.put(uispec);
    // ensure that the name is in the metadata
    // metadata.name = projectName.trim();
    yield (0, exports.writeProjectMetadata)(metaDB, metadata);
    // no need to write design docs for existing projects
    return project_id;
});
exports.updateNotebook = updateNotebook;
/**
 * deleteNotebook - DANGER!! Delete a notebook and all its data
 * @param project_id - project identifier
 */
const deleteNotebook = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    const projectsDB = (0, _1.getProjectsDB)();
    if (projectsDB) {
        const projectDoc = yield projectsDB.get(project_id);
        if (projectDoc) {
            const metaDB = yield (0, faims3_datamodel_1.getProjectDB)(project_id);
            const dataDB = yield (0, faims3_datamodel_2.getDataDB)(project_id);
            if (metaDB && dataDB) {
                yield metaDB.destroy();
                yield dataDB.destroy();
                // remove the project from the projectsDB
                yield projectsDB.remove(projectDoc);
            }
        }
    }
});
exports.deleteNotebook = deleteNotebook;
const writeProjectMetadata = (metaDB, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    // add metadata, one document per attribute value pair
    for (const field in metadata) {
        const doc = {
            _id: database_1.PROJECT_METADATA_PREFIX + '-' + field,
            is_attachment: false,
            metadata: metadata[field],
        };
        // is there already a version of this document?
        try {
            const existingDoc = yield metaDB.get(doc._id);
            doc['_rev'] = existingDoc['_rev'];
        }
        catch (_a) {
            // no existing document, so don't set the rev
        }
        yield metaDB.put(doc);
    }
    // also add the whole metadata as 'projectvalue'
    metadata._id = database_1.PROJECT_METADATA_PREFIX + '-projectvalue';
    try {
        const existingDoc = yield metaDB.get(metadata._id);
        metadata['_rev'] = existingDoc['_rev'];
    }
    catch (_b) {
        // no existing document, so don't set the rev
    }
    yield metaDB.put(metadata);
    return metadata;
});
exports.writeProjectMetadata = writeProjectMetadata;
/**
 * getNotebookMetadata -- return metadata for a single notebook from the database
 * @param project_id a project identifier
 * @returns a ProjectObject object or null if it doesn't exist
 */
const getNotebookMetadata = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = {};
    const isValid = yield (0, exports.validateNotebookID)(project_id);
    if (isValid) {
        try {
            // get the metadata from the db
            const projectDB = yield (0, faims3_datamodel_1.getProjectDB)(project_id);
            if (projectDB) {
                const metaDocs = yield projectDB.allDocs({ include_docs: true });
                metaDocs.rows.forEach((doc) => {
                    const id = doc['id'];
                    if (id && id.startsWith(database_1.PROJECT_METADATA_PREFIX)) {
                        const key = id.substring(database_1.PROJECT_METADATA_PREFIX.length + 1);
                        result[key] = doc.doc.metadata;
                    }
                });
                result.project_id = project_id;
                return result;
            }
            else {
                console.error('no metadata database found for', project_id);
            }
        }
        catch (error) {
            console.log('unknown project', project_id);
        }
    }
    else {
        console.log('unknown project', project_id);
    }
    return null;
});
exports.getNotebookMetadata = getNotebookMetadata;
/**
 * getNotebookUISpec -- return metadata for a single notebook from the database
 * @param project_id a project identifier
 * @returns the UISPec of the project or null if it doesn't exist
 */
const getNotebookUISpec = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // get the metadata from the db
        const projectDB = yield (0, faims3_datamodel_1.getProjectDB)(project_id);
        if (projectDB) {
            const uiSpec = (yield projectDB.get('ui-specification'));
            delete uiSpec._id;
            delete uiSpec._rev;
            return uiSpec;
        }
        else {
            console.error('no metadata database found for', project_id);
        }
    }
    catch (error) {
        console.log('unknown project', project_id);
    }
    return null;
});
exports.getNotebookUISpec = getNotebookUISpec;
/**
 * validateNotebookID - check that a project_id is a real notebook
 * @param project_id - a project identifier
 * @returns true if this is a valid project identifier
 */
const validateNotebookID = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectsDB = (0, _1.getProjectsDB)();
        if (projectsDB) {
            const projectDoc = yield projectsDB.get(project_id);
            if (projectDoc) {
                return true;
            }
        }
    }
    catch (error) {
        return false;
    }
    return false;
});
exports.validateNotebookID = validateNotebookID;
/**
 * getNotebookRecords - retrieve all data records for this notebook
 * including record metadata, data fields and annotations
 * @param project_id project identifier
 * @returns an array of records
 */
const getNotebookRecords = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    const records = yield (0, faims3_datamodel_2.getRecordsWithRegex)(project_id, '.*', true);
    const fullRecords = [];
    for (let i = 0; i < records.length; i++) {
        const data = yield (0, faims3_datamodel_2.getFullRecordData)(project_id, records[i].record_id, records[i].revision_id, true);
        fullRecords.push(data);
    }
    return fullRecords;
});
exports.getNotebookRecords = getNotebookRecords;
const getRecordHRID = (record) => {
    for (const possible_name of Object.keys(record.data)) {
        if (possible_name.startsWith(faims3_datamodel_2.HRID_STRING)) {
            return record.data[possible_name];
        }
    }
    return record.record_id;
};
/**
 * generate a suitable value for the CSV export from a field
 * value.  Serialise filenames, gps coordinates, etc.
 */
const csvFormatValue = (fieldName, fieldType, value, hrid, filenames) => {
    const result = {};
    if (fieldType === 'faims-attachment::Files') {
        if (value instanceof Array) {
            if (value.length === 0) {
                result[fieldName] = '';
                return result;
            }
            const valueList = value.map((v) => {
                if (v instanceof File) {
                    const filename = generateFilename(v, fieldName, hrid, filenames);
                    filenames.push(filename);
                    return filename;
                }
                else {
                    return v;
                }
            });
            result[fieldName] = valueList.join(';');
        }
        else {
            result[fieldName] = value;
        }
        return result;
    }
    // gps locations
    if (fieldType === 'faims-pos::Location') {
        if (value instanceof Object && 'geometry' in value) {
            result[fieldName] = value;
            result[fieldName + '_latitude'] = value.geometry.coordinates[0];
            result[fieldName + '_longitude'] = value.geometry.coordinates[1];
        }
        else {
            result[fieldName] = value;
            result[fieldName + '_latitude'] = '';
            result[fieldName + '_longitude'] = '';
        }
        return result;
    }
    if (fieldType === 'faims-core::Relationship') {
        if (value instanceof Array) {
            result[fieldName] = value
                .map((v) => {
                const relation_name = v.relation_type_vocabPair
                    ? v.relation_type_vocabPair[0]
                    : 'unknown relation';
                return `${relation_name}/${v.record_id}`;
            })
                .join(';');
        }
        else {
            result[fieldName] = value;
        }
        return result;
    }
    // default to just the value
    result[fieldName] = value;
    return result;
};
const convertDataForOutput = (fields, data, hrid, filenames) => {
    let result = {};
    fields.map((field) => {
        if (field.name in data) {
            const formattedValue = csvFormatValue(field.name, field.type, data[field.name], hrid, filenames);
            result = Object.assign(Object.assign({}, result), formattedValue);
        }
        else {
            console.error('field missing in data', field.name, data);
        }
    });
    return result;
};
const getNotebookFields = (project_id, viewID) => __awaiter(void 0, void 0, void 0, function* () {
    // work out what fields we're going to output from the uiSpec
    const uiSpec = yield (0, exports.getNotebookUISpec)(project_id);
    if (!uiSpec) {
        throw new Error("can't find project " + project_id);
    }
    if (!(viewID in uiSpec.viewsets)) {
        throw new Error(`invalid form ${viewID} not found in notebook`);
    }
    const views = uiSpec.viewsets[viewID].views;
    const fields = [];
    views.forEach((view) => {
        uiSpec.fviews[view].fields.forEach((field) => {
            fields.push(field);
        });
    });
    return fields;
});
exports.getNotebookFields = getNotebookFields;
const getNotebookFieldTypes = (project_id, viewID) => __awaiter(void 0, void 0, void 0, function* () {
    const uiSpec = yield (0, exports.getNotebookUISpec)(project_id);
    if (!uiSpec) {
        throw new Error("can't find project " + project_id);
    }
    if (!(viewID in uiSpec.viewsets)) {
        throw new Error(`invalid form ${viewID} not found in notebook`);
    }
    const views = uiSpec.viewsets[viewID].views;
    const fields = [];
    views.forEach((view) => {
        uiSpec.fviews[view].fields.forEach((field) => {
            fields.push({
                name: field,
                type: uiSpec.fields[field]['type-returned'],
            });
        });
    });
    return fields;
});
const streamNotebookRecordsAsCSV = (project_id, viewID, res) => __awaiter(void 0, void 0, void 0, function* () {
    const iterator = yield (0, faims3_datamodel_1.notebookRecordIterator)(project_id, viewID);
    const fields = yield getNotebookFieldTypes(project_id, viewID);
    let stringifier = null;
    let { record, done } = yield iterator.next();
    let header_done = false;
    const filenames = [];
    while (record && !done) {
        const hrid = getRecordHRID(record);
        const row = [
            hrid,
            record.record_id,
            record.revision_id,
            record.type,
            record.updated_by,
            record.updated.toISOString(),
        ];
        const outputData = convertDataForOutput(fields, record.data, hrid, filenames);
        Object.keys(outputData).forEach((property) => {
            row.push(outputData[property]);
        });
        if (!header_done) {
            const columns = [
                'identifier',
                'record_id',
                'revision_id',
                'type',
                'updated_by',
                'updated',
            ];
            // take the keys in the generated output data which may have more than
            // the original data
            Object.keys(outputData).forEach((key) => {
                columns.push(key);
            });
            stringifier = (0, csv_stringify_1.stringify)({ columns, header: true });
            // pipe output to the respose
            stringifier.pipe(res);
            header_done = true;
        }
        if (stringifier)
            stringifier.write(row);
        const next = yield iterator.next();
        record = next.record;
        done = next.done;
    }
    if (stringifier)
        stringifier.end();
});
exports.streamNotebookRecordsAsCSV = streamNotebookRecordsAsCSV;
const streamNotebookFilesAsZip = (project_id, viewID, res) => __awaiter(void 0, void 0, void 0, function* () {
    let allFilesAdded = false;
    let doneFinalize = false;
    const iterator = yield (0, faims3_datamodel_1.notebookRecordIterator)(project_id, viewID);
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', err => {
        if (err.code === 'ENOENT') {
            // log warning
        }
        else {
            // throw error
            throw err;
        }
    });
    // good practice to catch this error explicitly
    archive.on('error', err => {
        throw err;
    });
    // check on progress, if we've finished adding files and they are
    // all processed then we can finalize the archive
    archive.on('progress', (ev) => {
        if (!doneFinalize &&
            allFilesAdded &&
            ev.entries.total === ev.entries.processed) {
            try {
                archive.finalize();
                doneFinalize = true;
            }
            catch (_a) {
                // ignore ArchiveError
            }
        }
    });
    archive.pipe(res);
    let dataWritten = false;
    let { record, done } = yield iterator.next();
    const fileNames = [];
    while (!done) {
        // iterate over the fields, if it's a file, then
        // append it to the archive
        if (record !== null) {
            const hrid = getRecordHRID(record);
            Object.keys(record.data).forEach((key) => __awaiter(void 0, void 0, void 0, function* () {
                if (record && record.data[key] instanceof Array) {
                    if (record.data[key].length === 0) {
                        return;
                    }
                    if (record.data[key][0] instanceof File) {
                        const file_list = record.data[key];
                        file_list.forEach((file) => __awaiter(void 0, void 0, void 0, function* () {
                            const buffer = yield file.stream();
                            const reader = buffer.getReader();
                            // this is how we turn a File object into
                            // a Buffer to pass to the archiver, insane that
                            // we can't derive something from the file that will work
                            const chunks = [];
                            while (true) {
                                const { done, value } = yield reader.read();
                                if (done) {
                                    break;
                                }
                                chunks.push(value);
                            }
                            const stream = stream_1.Stream.Readable.from(chunks);
                            const filename = generateFilename(file, key, hrid, fileNames);
                            fileNames.push(filename);
                            yield archive.append(stream, {
                                name: filename,
                            });
                            dataWritten = true;
                        }));
                    }
                }
            }));
        }
        const next = yield iterator.next();
        record = next.record;
        done = next.done;
    }
    // if we didn't write any data then finalise because that won't happen elsewhere
    if (!dataWritten) {
        console.log('no data written');
        archive.abort();
    }
    allFilesAdded = true;
    // fire a progress event here because short/empty zip files don't
    // trigger it late enough for us to call finalize above
    archive.emit('progress', { entries: { processed: 0, total: 0 } });
});
exports.streamNotebookFilesAsZip = streamNotebookFilesAsZip;
const generateFilename = (file, key, hrid, filenames) => {
    const fileTypes = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/tiff': 'tif',
        'text/plain': 'txt',
        'application/pdf': 'pdf',
        'application/json': 'json',
    };
    const type = file.type;
    const extension = fileTypes[type] || 'dat';
    let filename = `${key}/${hrid}-${key}.${extension}`;
    let postfix = 1;
    while (filenames.find(f => f.localeCompare(filename) === 0)) {
        filename = `${key}/${hrid}-${key}_${postfix}.${extension}`;
        postfix += 1;
    }
    return filename;
};
const getRolesForNotebook = (project_id) => __awaiter(void 0, void 0, void 0, function* () {
    const meta = yield (0, exports.getNotebookMetadata)(project_id);
    if (meta) {
        const roles = meta.accesses || [];
        if (roles.indexOf('admin') < 0) {
            roles.push('admin');
        }
        if (roles.indexOf('user') < 0) {
            roles.push('user');
        }
        return roles;
    }
    else {
        return [];
    }
});
exports.getRolesForNotebook = getRolesForNotebook;
function countRecordsInNotebook(project_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataDB = yield (0, faims3_datamodel_2.getDataDB)(project_id);
        try {
            const res = yield dataDB.query('index/recordCount');
            if (res.rows.length === 0) {
                return 0;
            }
            return res.rows[0].value;
        }
        catch (error) {
            console.log(error);
            return 0;
        }
    });
}
exports.countRecordsInNotebook = countRecordsInNotebook;
/*
 * For saving and loading attachment with type faims-attachment::Files
 */
(0, faims3_datamodel_2.setAttachmentLoaderForType)('faims-attachment::Files', faims3_datamodel_2.file_attachments_to_data);
(0, faims3_datamodel_2.setAttachmentDumperForType)('faims-attachment::Files', faims3_datamodel_2.file_data_to_attachments);
