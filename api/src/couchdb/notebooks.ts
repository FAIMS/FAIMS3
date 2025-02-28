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

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import SecurityPlugin from 'pouchdb-security-helper';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(SecurityPlugin);

import {
  addDesignDocsForNotebook,
  APINotebookList,
  CLUSTER_ADMIN_GROUP_NAME,
  EncodedProjectUIModel,
  notebookRecordIterator,
  ProjectID,
  ProjectObject,
} from '@faims3/data-model';
import archiver from 'archiver';
import {Stream} from 'stream';
import {getMetadataDb, getProjectsDB, verifyCouchDBConnection} from '.';
import {COUCHDB_PUBLIC_URL} from '../buildconfig';
import {
  PROJECT_METADATA_PREFIX,
  ProjectMetadata,
  ProjectUIFields,
} from '../datamodel/database';
import * as Exceptions from '../exceptions';

import {
  file_attachments_to_data,
  file_data_to_attachments,
  getDataDB,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
} from '@faims3/data-model';
import {Stringifier, stringify} from 'csv-stringify';
import {slugify} from '../utils';
import {userHasPermission} from './users';

/**
 * getProjects - get the internal project documents that reference
 * the project databases that the front end will connnect to
 * @param user - only return projects visible to this user
 */
export const getProjects = async (
  user: Express.User
): Promise<ProjectObject[]> => {
  const projects: ProjectObject[] = [];

  const projects_db = getProjectsDB();
  if (projects_db) {
    const res = await projects_db.allDocs({
      include_docs: true,
    });
    res.rows.forEach(e => {
      if (e.doc !== undefined && !e.id.startsWith('_')) {
        const doc = e.doc as any;
        if (userHasPermission(user, e.id, 'read')) {
          delete doc._rev;
          const project = doc as unknown as ProjectObject;
          // add database connection details
          if (project.metadata_db)
            project.metadata_db.base_url = COUCHDB_PUBLIC_URL;
          if (project.data_db) project.data_db.base_url = COUCHDB_PUBLIC_URL;
          projects.push(project);
        }
      }
    });
  }
  return projects;
};

/**
 * getNotebooks -- return an array of notebooks from the database
 * @oaram user - only return notebooks that this user can see
 * @returns an array of ProjectObject objects
 */
export const getNotebooks = async (
  user: Express.User
): Promise<APINotebookList[]> => {
  // Respond with notebook list model
  const output: APINotebookList[] = [];
  // DB records are project objects
  const projects: ProjectObject[] = [];
  const projects_db = getProjectsDB();
  if (projects_db) {
    // We want to type hint that this will include all values
    const res = await projects_db.allDocs<ProjectObject>({
      include_docs: true,
    });
    res.rows.forEach(e => {
      if (e.doc !== undefined && !e.id.startsWith('_')) {
        projects.push(e.doc);
      }
    });

    for (const project of projects) {
      const projectId = project._id;
      const projectMeta = await getNotebookMetadata(projectId);
      if (userHasPermission(user, projectId, 'read')) {
        output.push({
          name: project.name,
          is_admin: userHasPermission(user, projectId, 'modify'),
          last_updated: project.last_updated,
          created: project.created,
          template_id: project.template_id,
          status: project.status,
          project_id: projectId,
          metadata: projectMeta,
        });
      }
    }
  }
  return output;
};

/**
 * Generate a good project identifier for a new project
 * @param projectName the project name string
 * @returns a suitable project identifier
 */
const generateProjectID = (projectName: string): ProjectID => {
  return `${Date.now().toFixed()}-${slugify(projectName)}`;
};

type AutoIncReference = {
  form_id: string;
  field_id: string;
  label: string;
};

type AutoIncrementObject = {
  _id: string;
  references: AutoIncReference[];
};

/**
 * Derive an autoincrementers object from a UI Spec
 *   find all of the autoincrement fields in the UISpec and create an
 *   entry for each of them.
 * @param uiSpec a project UI Model
 * @returns an autoincrementers object suitable for insertion into the db or
 *          undefined if there are no such fields
 */
const getAutoIncrementers = (uiSpec: EncodedProjectUIModel) => {
  // Note that this relies on the name 'local-autoincrementers' being the same as that
  // used in the front-end code (LOCAL_AUTOINCREMENTERS_NAME in src/local-data/autoincrementers.ts)
  const autoinc: AutoIncrementObject = {
    _id: 'local-autoincrementers',
    references: [],
  };

  const fields = uiSpec.fields as ProjectUIFields;
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
  } else {
    return undefined;
  }
};

/**
 * validateDatabases - check that all notebook databases are set up
 *  properly, add design documents if they are missing
 */
export const validateDatabases = async () => {
  const projects: ProjectObject[] = [];
  try {
    const report = await verifyCouchDBConnection();

    if (!report.valid) {
      return report;
    }

    const projects_db = getProjectsDB();
    if (projects_db) {
      const res = await projects_db.allDocs({
        include_docs: true,
      });
      res.rows.forEach(e => {
        if (e.doc !== undefined && !e.id.startsWith('_')) {
          projects.push(e.doc as unknown as ProjectObject);
        }
      });

      for (const project of projects) {
        const project_id = project._id;
        const dataDB = await getDataDB(project_id);
        // ensure that design documents are here
        await addDesignDocsForNotebook(dataDB);
      }
    }
    return report;
  } catch (e) {
    return {valid: false};
  }
};

/**
 * Create notebook databases and initialise them with required contents
 *
 * @param projectName Human readable project name
 * @param uispec A project Ui Specification
 * @param metadata A metadata object with properties/values
 * @returns the project id
 */
export const createNotebook = async (
  projectName: string,
  uispec: EncodedProjectUIModel,
  metadata: any,
  template_id: string | undefined = undefined
) => {
  const project_id = generateProjectID(projectName);

  const metaDBName = `metadata-${project_id}`;
  const dataDBName = `data-${project_id}`;
  const projectDoc = {
    _id: project_id,
    template_id: template_id,
    name: projectName.trim(),
    metadata_db: {
      db_name: metaDBName,
    },
    data_db: {
      db_name: dataDBName,
    },
    status: 'published',
  } as ProjectObject;

  try {
    // first add an entry to the projects db about this project
    // this is used to find the other databases below
    const projectsDB = getProjectsDB();
    if (projectsDB) {
      await projectsDB.put(projectDoc);
    }
  } catch (error) {
    console.log('Error creating project entry in projects database:', error);
    return undefined;
  }

  const metaDB = await getMetadataDb(project_id);
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
    const metaSecurity = await metaDB.security();
    metaSecurity.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
    roles.forEach((role: string) => {
      metaSecurity.members.roles.add(`${project_id}||${role}`);
    });
    await metaSecurity.save();
  }

  // derive autoincrementers from uispec
  const autoIncrementers = getAutoIncrementers(uispec);
  if (autoIncrementers) {
    await metaDB.put(autoIncrementers);
  }
  uispec['_id'] = 'ui-specification';
  await metaDB.put(uispec as PouchDB.Core.PutDocument<EncodedProjectUIModel>);

  // ensure that the name is in the metadata
  metadata.name = projectName.trim();
  await writeProjectMetadata(metaDB, metadata);
  // data database
  const dataDB = await getDataDB(project_id);
  if (!dataDB) {
    return undefined;
  }
  // can't save security on a memory database so skip this if we're testing
  if (process.env.NODE_ENV !== 'test') {
    const dataSecurity = await dataDB.security();
    dataSecurity.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
    roles.forEach((role: string) => {
      dataSecurity.members.roles.add(`${project_id}||${role}`);
    });
    await dataSecurity.save();
  }

  try {
    await addDesignDocsForNotebook(dataDB);
  } catch (error) {
    console.log(error);
  }
  return project_id;
};

/**
 * Update an existing notebook definition
 * @param project_id Project identifier
 * @param uispec Project UI Spec object
 * @param metadata Project Metadata
 * @returns project_id or undefined if the project doesn't exist
 */
export const updateNotebook = async (
  project_id: string,
  uispec: EncodedProjectUIModel,
  metadata: any
) => {
  const metaDB = await getMetadataDb(project_id);
  const dataDB = await getDataDB(project_id);
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

    if (!(CLUSTER_ADMIN_GROUP_NAME in metaSecurity.admins.roles)) {
      metaSecurity.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
      dataSecurity.admins.roles.add(CLUSTER_ADMIN_GROUP_NAME);
    }
    roles.forEach((role: string) => {
      const permission = `${project_id}||${role}`;
      if (!(permission in metaSecurity.members.roles)) {
        metaSecurity.members.roles.add(permission);
        dataSecurity.members.roles.add(permission);
      }
    });
    await metaSecurity.save();
  }

  // derive autoincrementers from uispec
  const autoIncrementers = getAutoIncrementers(uispec);
  if (autoIncrementers) {
    // need to update any existing autoincrementer document
    // this should have the _rev property so that our update will work
    const existingAutoInc = (await metaDB.get(
      'local-autoincrementers'
    )) as AutoIncrementObject;
    if (existingAutoInc) {
      existingAutoInc.references = autoIncrementers.references;
      await metaDB.put(existingAutoInc);
    } else {
      await metaDB.put(autoIncrementers);
    }
  }

  // update the existing uispec document
  // need the revision id of the existing one to do this...
  const existingUISpec = await metaDB.get('ui-specification');
  // set the id and rev
  uispec['_id'] = 'ui-specification';
  uispec['_rev'] = existingUISpec['_rev'];
  // now store it to update the spec
  await metaDB.put(uispec as PouchDB.Core.PutDocument<EncodedProjectUIModel>);

  // ensure that the name is in the metadata
  // metadata.name = projectName.trim();
  await writeProjectMetadata(metaDB, metadata);

  // no need to write design docs for existing projects
  return project_id;
};

/**
 * deleteNotebook - DANGER!! Delete a notebook and all its data
 * @param project_id - project identifier
 */
export const deleteNotebook = async (project_id: string) => {
  // Get the projects DB
  const projectsDB = getProjectsDB();

  // If not found, 404
  if (!projectsDB) {
    throw new Exceptions.InternalSystemError(
      'Could not get the notebooks database. Contact a system administrator.'
    );
  }

  // Get the project document for given project ID
  const projectDoc = await projectsDB.get(project_id);

  if (!projectDoc) {
    throw new Exceptions.ItemNotFoundException(
      'Could not find the specified project. Are you sure the project id is correct?'
    );
  }

  // This gets the metadata DB
  const metaDB = await getMetadataDb(project_id);
  // This gets the data DB
  const dataDB = await getDataDB(project_id);

  await metaDB.destroy();
  await dataDB.destroy();

  // remove the project from the projectsDB
  await projectsDB.remove(projectDoc);
};

export const writeProjectMetadata = async (
  metaDB: PouchDB.Database,
  metadata: any
) => {
  // add metadata, one document per attribute value pair
  for (const field in metadata) {
    const doc: any = {
      _id: PROJECT_METADATA_PREFIX + '-' + field,
      is_attachment: false, // TODO: well it might not be false! Deal with attachments
      metadata: metadata[field],
    };
    // is there already a version of this document?
    try {
      const existingDoc = await metaDB.get(doc._id);
      doc['_rev'] = existingDoc['_rev'];
    } catch {
      // no existing document, so don't set the rev
    }
    await metaDB.put(doc);
  }
  // also add the whole metadata as 'projectvalue'
  metadata._id = PROJECT_METADATA_PREFIX + '-projectvalue';
  try {
    const existingDoc = await metaDB.get(metadata._id);
    metadata['_rev'] = existingDoc['_rev'];
  } catch {
    // no existing document, so don't set the rev
  }
  await metaDB.put(metadata);
  return metadata;
};

/**
 * getNotebookMetadata -- return metadata for a single notebook from the database
 * @param project_id a project identifier
 * @returns a ProjectObject object or null if it doesn't exist
 */
export const getNotebookMetadata = async (
  project_id: string
): Promise<ProjectMetadata | null> => {
  const result: ProjectMetadata = {};
  const isValid = await validateNotebookID(project_id);
  if (isValid) {
    try {
      // get the metadata from the db
      const projectDB = await getMetadataDb(project_id);
      if (projectDB) {
        const metaDocs = await projectDB.allDocs({include_docs: true});
        metaDocs.rows.forEach((doc: any) => {
          const id: string = doc['id'];
          if (id && id.startsWith(PROJECT_METADATA_PREFIX)) {
            const key: string = id.substring(
              PROJECT_METADATA_PREFIX.length + 1
            );
            result[key] = doc.doc.metadata;
          }
        });
        result.project_id = project_id;
        return result;
      } else {
        console.error('no metadata database found for', project_id);
      }
    } catch (error) {
      console.log('unknown project', project_id);
    }
  } else {
    console.log('unknown project', project_id);
  }
  return null;
};

/**
 * getNotebookUISpec -- return metadata for a single notebook from the database
 * @param project_id a project identifier
 * @returns the UISPec of the project or null if it doesn't exist
 */
export const getNotebookUISpec = async (
  project_id: string
): Promise<EncodedProjectUIModel | null> => {
  try {
    // get the metadata from the db
    const projectDB = await getMetadataDb(project_id);
    if (projectDB) {
      const uiSpec = (await projectDB.get('ui-specification')) as any;
      delete uiSpec._id;
      delete uiSpec._rev;
      return uiSpec;
    } else {
      console.error('no metadata database found for', project_id);
    }
  } catch (error) {
    console.log('unknown project', project_id);
  }
  return null;
};

// Ridiculous!
export const getProjectUIModel = async (projectId: string) => {
  const rawUiSpec = await getNotebookUISpec(projectId);
  if (!rawUiSpec) {
    throw Error('Could not find UI spec for project with ID ' + projectId);
  }
  return {
    _id: rawUiSpec._id,
    _rev: rawUiSpec._rev,
    fields: rawUiSpec.fields,
    views: rawUiSpec.fviews,
    viewsets: rawUiSpec.viewsets,
    visible_types: rawUiSpec.visible_types,
  };
};

/**
 * validateNotebookID - check that a project_id is a real notebook
 * @param project_id - a project identifier
 * @returns true if this is a valid project identifier
 */
export const validateNotebookID = async (
  project_id: string
): Promise<boolean> => {
  try {
    const projectsDB = getProjectsDB();
    if (projectsDB) {
      const projectDoc = await projectsDB.get(project_id);
      if (projectDoc) {
        return true;
      }
    }
  } catch (error) {
    return false;
  }
  return false;
};

/**
 * generate a suitable value for the CSV export from a field
 * value.  Serialise filenames, gps coordinates, etc.
 */
const csvFormatValue = (
  fieldName: string,
  fieldType: string,
  value: any,
  hrid: string,
  filenames: string[]
) => {
  const result: {[key: string]: any} = {};
  if (fieldType === 'faims-attachment::Files') {
    if (value instanceof Array) {
      if (value.length === 0) {
        result[fieldName] = '';
        return result;
      }
      const valueList = value.map((v: any) => {
        if (v instanceof File) {
          const filename = generateFilenameForAttachment(
            v,
            fieldName,
            hrid,
            filenames
          );
          filenames.push(filename);
          return filename;
        } else {
          return v;
        }
      });
      result[fieldName] = valueList.join(';');
    } else {
      result[fieldName] = value;
    }
    return result;
  }

  // gps locations
  if (fieldType === 'faims-pos::Location') {
    if (
      value instanceof Object &&
      'geometry' in value &&
      value.geometry.coordinates.length === 2
    ) {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = value.geometry.coordinates[1];
      result[fieldName + '_longitude'] = value.geometry.coordinates[0];
      result[fieldName + '_accuracy'] = value.properties.accuracy || '';
    } else {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = '';
      result[fieldName + '_longitude'] = '';
      result[fieldName + '_accuracy'] = '';
    }
    return result;
  }

  if (fieldType === 'faims-core::JSON') {
    // map location, if it's a point we can pull out lat/long
    if (
      value instanceof Object &&
      'features' in value &&
      value.features.length > 0 &&
      value.features[0]?.geometry?.type === 'Point' &&
      value.features[0].geometry.coordinates.length === 2
    ) {
      result[fieldName] = value;
      result[fieldName + '_latitude'] =
        value.features[0].geometry.coordinates[1];
      result[fieldName + '_longitude'] =
        value.features[0].geometry.coordinates[0];
      return result;
    } else {
      result[fieldName] = value;
      result[fieldName + '_latitude'] = '';
      result[fieldName + '_longitude'] = '';
    }
  }

  if (fieldType === 'faims-core::Relationship') {
    if (value instanceof Array) {
      result[fieldName] = value
        .map((v: any) => {
          const relation_name = v.relation_type_vocabPair
            ? v.relation_type_vocabPair[0]
            : 'unknown relation';
          return `${relation_name}/${v.record_id}`;
        })
        .join(';');
    } else {
      result[fieldName] = value;
    }
    return result;
  }

  // default to just the value
  result[fieldName] = value;
  return result;
};

const convertDataForOutput = (
  fields: {name: string; type: string}[],
  data: any,
  hrid: string,
  filenames: string[]
) => {
  let result: {[key: string]: any} = {};
  fields.map((field: any) => {
    if (field.name in data) {
      const formattedValue = csvFormatValue(
        field.name,
        field.type,
        data[field.name],
        hrid,
        filenames
      );
      result = {...result, ...formattedValue};
    } else {
      console.error('field missing in data', field.name, data);
    }
  });
  return result;
};

export const getNotebookFields = async (
  project_id: ProjectID,
  viewID: string
) => {
  // work out what fields we're going to output from the uiSpec
  const uiSpec = await getNotebookUISpec(project_id);
  if (!uiSpec) {
    throw new Error("can't find project " + project_id);
  }
  if (!(viewID in uiSpec.viewsets)) {
    throw new Error(`invalid form ${viewID} not found in notebook`);
  }
  const views = uiSpec.viewsets[viewID].views;
  const fields: string[] = [];
  views.forEach((view: any) => {
    uiSpec.fviews[view].fields.forEach((field: any) => {
      fields.push(field);
    });
  });
  return fields;
};

const getNotebookFieldTypes = async (project_id: ProjectID, viewID: string) => {
  const uiSpec = await getNotebookUISpec(project_id);
  if (!uiSpec) {
    throw new Error("can't find project " + project_id);
  }
  if (!(viewID in uiSpec.viewsets)) {
    throw new Error(`invalid form ${viewID} not found in notebook`);
  }
  const views = uiSpec.viewsets[viewID].views;
  const fields: any[] = [];
  views.forEach((view: any) => {
    uiSpec.fviews[view].fields.forEach((field: any) => {
      fields.push({
        name: field,
        type: uiSpec.fields[field]['type-returned'],
      });
    });
  });
  return fields;
};

export const streamNotebookRecordsAsCSV = async (
  project_id: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
) => {
  const uiSpec = await getProjectUIModel(project_id);
  const iterator = await notebookRecordIterator(
    project_id,
    viewID,
    undefined,
    uiSpec
  );
  const fields = await getNotebookFieldTypes(project_id, viewID);

  let stringifier: Stringifier | null = null;
  let {record, done} = await iterator.next();
  let header_done = false;
  const filenames: string[] = [];
  while (!done) {
    // record might be null if there was an invalid db entry
    if (record) {
      const hrid = record.hrid || record.record_id;
      const row = [
        hrid,
        record.record_id,
        record.revision_id,
        record.type,
        record.created_by,
        record.created.toISOString(),
        record.updated_by,
        record.updated.toISOString(),
      ];
      const outputData = convertDataForOutput(
        fields,
        record.data,
        hrid,
        filenames
      );
      Object.keys(outputData).forEach((property: string) => {
        row.push(outputData[property]);
      });

      if (!header_done) {
        const columns = [
          'identifier',
          'record_id',
          'revision_id',
          'type',
          'created_by',
          'created',
          'updated_by',
          'updated',
        ];
        // take the keys in the generated output data which may have more than
        // the original data
        Object.keys(outputData).forEach((key: string) => {
          columns.push(key);
        });
        stringifier = stringify({columns, header: true});
        // pipe output to the respose
        stringifier.pipe(res);
        header_done = true;
      }
      if (stringifier) stringifier.write(row);
    }
    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }
  if (stringifier) {
    stringifier.end();
  } else {
    // no records to export so just send the bare column headings
    const columns = [
      'identifier',
      'record_id',
      'revision_id',
      'type',
      'created_by',
      'created',
      'updated_by',
      'updated',
    ];
    stringifier = stringify({columns, header: true});
    // pipe output to the respose
    stringifier.pipe(res);
    stringifier.end();
  }
};

export const streamNotebookFilesAsZip = async (
  project_id: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
) => {
  let allFilesAdded = false;
  let doneFinalize = false;
  const uiSpec = await getProjectUIModel(project_id);
  const iterator = await notebookRecordIterator(
    project_id,
    viewID,
    undefined,
    uiSpec
  );
  const archive = archiver('zip', {zlib: {level: 9}});
  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      // log warning
    } else {
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
  archive.on('progress', (ev: any) => {
    if (
      !doneFinalize &&
      allFilesAdded &&
      ev.entries.total === ev.entries.processed
    ) {
      try {
        archive.finalize();
        doneFinalize = true;
      } catch {
        // ignore ArchiveError
      }
    }
  });

  archive.pipe(res);
  let dataWritten = false;
  let {record, done} = await iterator.next();
  const fileNames: string[] = [];
  while (!done) {
    // iterate over the fields, if it's a file, then
    // append it to the archive
    if (record !== null) {
      const hrid = record.hrid || record.record_id;
      Object.keys(record.data).forEach(async (key: string) => {
        if (record && record.data[key] instanceof Array) {
          if (record.data[key].length === 0) {
            return;
          }
          if (record.data[key][0] instanceof File) {
            const file_list = record.data[key] as File[];
            file_list.forEach(async (file: File) => {
              const buffer = await file.stream();
              const reader = buffer.getReader();
              // this is how we turn a File object into
              // a Buffer to pass to the archiver, insane that
              // we can't derive something from the file that will work
              const chunks: Uint8Array[] = [];
              while (true) {
                const {done, value} = await reader.read();
                if (done) {
                  break;
                }
                chunks.push(value);
              }
              const stream = Stream.Readable.from(chunks);
              const filename = generateFilenameForAttachment(
                file,
                key,
                hrid,
                fileNames
              );
              fileNames.push(filename);
              await archive.append(stream, {
                name: filename,
              });
              dataWritten = true;
            });
          }
        }
      });
    }
    const next = await iterator.next();
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
  archive.emit('progress', {entries: {processed: 0, total: 0}});
};

export const generateFilenameForAttachment = (
  file: File,
  key: string,
  hrid: string,
  filenames: string[]
) => {
  const fileTypes: {[key: string]: string} = {
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

/**
 * Fetches the roles configured for a notebook from the notebook metadata DB.
 * @param project_id The project ID to lookup
 * @param metadata If the project metadata is known, no need to fetch it again
 * @returns A list of roles for this notebook including at least admin and user
 */
export const getRolesForNotebook = async (
  project_id: ProjectID,
  // If metadata is already known, pass it in here
  metadata: ProjectMetadata | undefined = undefined
): Promise<string[]> => {
  // Either use provided metadata or fetch it
  let meta: ProjectMetadata;
  if (metadata) {
    meta = metadata;
  } else {
    // Gets the metadata for the notebook
    const possibleMetadata = await getNotebookMetadata(project_id);
    if (!possibleMetadata) {
      throw new Exceptions.InternalSystemError(
        'Failed to retrieve roles from the metadata DB for the given project ID.'
      );
    }
    meta = possibleMetadata;
  }

  // Include all of these roles
  const roles = meta.accesses || [];
  // But also add admin and user if not included
  if (roles.indexOf('admin') < 0) {
    roles.push('admin');
  }
  if (roles.indexOf('user') < 0) {
    roles.push('user');
  }
  return roles;
};

export async function countRecordsInNotebook(
  project_id: ProjectID
): Promise<Number> {
  const dataDB = await getDataDB(project_id);
  try {
    const res = await dataDB.query('index/recordCount');
    if (res.rows.length === 0) {
      return 0;
    }
    return res.rows[0].value;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

/*
 * For saving and loading attachment with type faims-attachment::Files
 */

setAttachmentLoaderForType('faims-attachment::Files', file_attachments_to_data);
setAttachmentDumperForType('faims-attachment::Files', file_data_to_attachments);
