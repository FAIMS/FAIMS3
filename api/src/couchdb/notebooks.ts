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
  Action,
  APINotebookList,
  CouchProjectUIModel,
  EncodedProjectUIModel,
  ExistingProjectDocument,
  GetNotebookListResponse,
  logError,
  notebookRecordIterator,
  ProjectDBFields,
  ProjectDocument,
  ProjectID,
  ProjectMetadata,
  PROJECTS_BY_TEAM_ID,
  ProjectStatus,
  Resource,
  resourceRoles,
  Role,
  userHasProjectRole,
  PROJECT_METADATA_PREFIX,
  Annotations,
} from '@faims3/data-model';
import archiver from 'archiver';
import {Stream} from 'stream';
import {
  getDataDb,
  getMetadataDb,
  initialiseDataDb,
  initialiseMetadataDb,
  localGetProjectsDb,
  verifyCouchDBConnection,
} from '.';
import {COUCHDB_PUBLIC_URL, DEVELOPER_MODE} from '../buildconfig';
import * as Exceptions from '../exceptions';

import {
  decodeUiSpec,
  file_attachments_to_data,
  file_data_to_attachments,
  getDataDB,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
} from '@faims3/data-model';
import {Stringifier, stringify} from 'csv-stringify';
import {userCanDo} from '../middleware';
import {slugify} from '../utils';

/**
 * Gets project IDs by teamID (who owns it)
 * @returns an array of template ids
 */
export const getProjectIdsByTeamId = async ({
  teamId,
}: {
  teamId: string;
}): Promise<string[]> => {
  const projectsDb = localGetProjectsDb();
  try {
    const resultList = await projectsDb.query<ProjectDBFields>(
      PROJECTS_BY_TEAM_ID,
      {
        key: teamId,
        include_docs: false,
      }
    );
    return resultList.rows
      .filter(res => {
        return !res.id.startsWith('_');
      })
      .map(res => {
        return res.id;
      });
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading projects by team ID from the Project DB.'
    );
  }
};

/**
 * Gets a single project document from DB
 */
export const getProjectById = async (
  id: string
): Promise<ExistingProjectDocument> => {
  try {
    return await localGetProjectsDb().get(id);
  } catch (e) {
    // Could not find the project
    throw new Exceptions.ItemNotFoundException(
      `Failed to find the project with ID ${id}.`
    );
  }
};

/**
 * Puts a single project document
 */
export const putProjectDoc = async (doc: ProjectDocument) => {
  try {
    return await localGetProjectsDb().put(doc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'Could not put document into Projects DB.'
    );
  }
};

/**
 * getAllProjects - get the internal project documents that reference
 * the project databases that the front end will connnect to
 */
export const getAllProjectsDirectory = async (): Promise<ProjectDocument[]> => {
  const projectsDb = localGetProjectsDb();
  const projects: ProjectDocument[] = [];
  const res = await projectsDb.allDocs<ProjectDocument>({
    include_docs: true,
  });
  res.rows.forEach(e => {
    if (e.doc !== undefined && !e.id.startsWith('_')) {
      const doc = e.doc;
      const project = {...doc, _rev: undefined};
      // delete rev so that we don't include in the result
      delete project._rev;
      // add database connection details
      if (project.metadataDb) project.metadataDb.base_url = COUCHDB_PUBLIC_URL;
      if (project.dataDb) project.dataDb.base_url = COUCHDB_PUBLIC_URL;
      projects.push(project);
    }
  });
  return projects;
};

/**
 * getUserProjects - get the internal project documents that reference
 * the project databases that the front end will connnect to
 * @param user - only return projects visible to this user
 */
export const getUserProjectsDirectory = async (
  user: Express.User
): Promise<ProjectDocument[]> => {
  return (await getAllProjectsDirectory()).filter(p =>
    userCanDo({
      user,
      action: Action.READ_PROJECT_METADATA,
      resourceId: p._id,
    })
  );
};

/**
 * getNotebooks -- return an array of notebooks from the database
 * @param user - only return notebooks that this user can see
 * @returns an array of ProjectDocument objects
 */
export const getUserProjectsDetailed = async (
  user: Express.User,
  teamId: string | undefined = undefined
): Promise<APINotebookList[]> => {
  // Get projects DB
  const projectsDb = localGetProjectsDb();

  // Get all projects and filter for user access

  let allDocs;
  if (!teamId) {
    allDocs = await projectsDb.allDocs<ProjectDocument>({
      include_docs: true,
    });
  } else {
    allDocs = await projectsDb.query<ProjectDocument>(PROJECTS_BY_TEAM_ID, {
      key: teamId,
      include_docs: true,
    });
  }

  const userProjects = allDocs.rows
    .map(r => r.doc)
    .filter(d => d !== undefined && !d._id.startsWith('_'))
    .filter(p =>
      userCanDo({
        action: Action.READ_PROJECT_METADATA,
        resourceId: p!._id,
        user,
      })
    );

  // Process all projects in parallel using Promise.all
  const output = await Promise.all(
    userProjects.map(async project => {
      try {
        const projectId = project!._id;
        const projectMeta = await getNotebookMetadata(projectId);

        return {
          name: project!.name,
          is_admin: userHasProjectRole({
            user,
            projectId,
            role: Role.PROJECT_ADMIN,
          }),
          template_id: project!.templateId,
          project_id: projectId,
          metadata: projectMeta,
          ownedByTeamId: project!.ownedByTeamId,
          status: project!.status,
        } satisfies GetNotebookListResponse[number];
      } catch (e) {
        console.error('Error occurred during detailed notebook listing');
        logError(e);
        return undefined;
      }
    })
  );

  // Filter out null values from projects that user couldn't read
  return output.filter(item => item !== undefined);
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
  } else {
    return undefined;
  }
};

/**
 * validateDatabases - check that all notebook databases are set up
 *  properly, add design documents if they are missing
 */
export const validateDatabases = async () => {
  try {
    const report = await verifyCouchDBConnection();

    if (!report.valid) {
      return report;
    }

    const projects = await getAllProjectsDirectory();

    for (const project of projects) {
      const projectId = project._id;
      const metadata = await getNotebookMetadata(projectId);
      if (!metadata) {
        throw new Exceptions.InternalSystemError(
          'No metadata DB setup for project with ID ' + projectId
        );
      }
      await initialiseDataDb({
        projectId,
        force: true,
      });
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
  template_id: string | undefined = undefined,
  teamId: string | undefined = undefined
) => {
  const projectId = generateProjectID(projectName);
  const metaDBName = `metadata-${projectId}`;
  const dataDBName = `data-${projectId}`;
  const projectDoc = {
    _id: projectId,
    name: projectName.trim(),
    templateId: template_id,
    metadataDb: {
      db_name: metaDBName,
    },
    dataDb: {
      db_name: dataDBName,
    },
    // Default status is open
    status: ProjectStatus.OPEN,
    ownedByTeamId: teamId,
  } satisfies ProjectDocument;

  try {
    // first add an entry to the projects db about this project
    // this is used to find the other databases below
    const projectsDB = localGetProjectsDb();
    if (projectsDB) {
      await projectsDB.put(projectDoc);
    }
  } catch (error) {
    console.log('Error creating project entry in projects database:', error);
    return undefined;
  }

  // Initialise the metadata DB
  const metaDB = await initialiseMetadataDb({
    projectId,
    force: true,
  });

  // derive autoincrementers from uispec
  const autoIncrementers = getAutoIncrementers(uispec);
  if (autoIncrementers) {
    await metaDB.put(autoIncrementers);
  }
  const payload = {_id: 'ui-specification', ...uispec};
  await metaDB.put(
    payload satisfies PouchDB.Core.PutDocument<EncodedProjectUIModel>
  );

  // ensure that the name is in the metadata
  metadata.name = projectName.trim();
  await writeProjectMetadata(metaDB, metadata);

  // data database
  await initialiseDataDb({
    projectId,
    force: true,
  });

  return projectId;
};

/**
 * Update an existing notebook definition
 * @param projectId Project identifier
 * @param uispec Project UI Spec object
 * @param metadata Project Metadata
 * @returns project_id or undefined if the project doesn't exist
 */
export const updateNotebook = async (
  projectId: string,
  uispec: EncodedProjectUIModel,
  metadata: any
) => {
  // Re-initialise metadata/data dbs (includes security update)
  const metaDB = await initialiseMetadataDb({
    projectId,
    force: true,
  });
  await initialiseMetadataDb({
    projectId,
    force: true,
  });

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
  const payload = {
    _id: 'ui-specification',
    _rev: existingUISpec['_rev'],
    ...uispec,
  };
  // now store it to update the spec
  await metaDB.put(
    payload satisfies PouchDB.Core.PutDocument<EncodedProjectUIModel>
  );

  // ensure that the name is in the metadata
  // metadata.name = projectName.trim();
  await writeProjectMetadata(metaDB, metadata);

  // no need to write design docs for existing projects
  return projectId;
};

/**
 * Updates the notebook status to the targeted value
 */
export const changeNotebookStatus = async ({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) => {
  // get existing project record
  const project = await getProjectById(projectId);

  // update status
  const updated = {...project, status};

  // write it back
  await putProjectDoc(updated);
};

/**
 * Updates the team associated with a notebook
 */
export const changeNotebookTeam = async ({
  projectId,
  teamId,
}: {
  projectId: string;
  teamId: string;
}) => {
  // get existing project record
  const project = await getProjectById(projectId);

  // update team
  const updated = {...project, ownedByTeamId: teamId};

  // write it back
  await putProjectDoc(updated);
};

/**
 * deleteNotebook - DANGER!! Delete a notebook and all its data
 * @param project_id - project identifier
 */
export const deleteNotebook = async (project_id: string) => {
  // Get the projects DB
  const projectsDB = localGetProjectsDb();

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
 * @returns a ProjectDocument object or null if it doesn't exist
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
 * @param projectId a project identifier
 * @returns the UISPec of the project or null if it doesn't exist
 */
export const getEncodedNotebookUISpec = async (
  projectId: string
): Promise<CouchProjectUIModel | null> => {
  try {
    // get the metadata from the db
    const projectDB = await getMetadataDb(projectId);
    if (projectDB) {
      const uiSpec = (await projectDB.get('ui-specification')) as any;
      delete uiSpec._id;
      delete uiSpec._rev;
      return uiSpec;
    } else {
      console.error('no metadata database found for', projectId);
    }
  } catch (error) {
    console.log('unknown project', projectId);
  }
  return null;
};

/**
 * Gets the ready to use representation of the UI spec for a given project.
 *
 * Does this by fetching from the metadata DB and decoding.
 *
 * @param projectId
 * @returns The decoded project UI model (not compiled)
 */
export const getProjectUIModel = async (projectId: string) => {
  const rawUiSpec = await getEncodedNotebookUISpec(projectId);
  if (!rawUiSpec) {
    throw Error('Could not find UI spec for project with ID ' + projectId);
  }
  return decodeUiSpec(rawUiSpec);
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
    const projectsDB = localGetProjectsDb();
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

type FieldSummary = {
  name: string;
  type: string;
  annotation?: string;
  uncertainty?: string;
};

/**
 * Convert annotations on a field to a format suitable for CSV export
 */
const csvFormatAnnotation = (
  field: FieldSummary,
  {annotation, uncertainty}: Annotations
) => {
  const result: {[key: string]: any} = {};
  if (field.annotation !== '')
    result[field.name + '_' + field.annotation] = annotation;
  if (field.uncertainty !== '')
    result[field.name + '_' + field.uncertainty] = uncertainty
      ? 'true'
      : 'false';
  return result;
};

/**
 * Format the data for a single record for CSV export
 *
 * @returns a map of column headings to values
 */
const convertDataForOutput = (
  fields: FieldSummary[],
  data: any,
  annotations: {[name: string]: Annotations},
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
      const formattedAnnotation = csvFormatAnnotation(
        field,
        annotations[field.name] || {}
      );
      result = {...result, ...formattedValue, ...formattedAnnotation};
    } else {
      console.error('field missing in data', field.name, data);
    }
  });
  return result;
};

/**
 * Get a list of fields for a notebook with relevant information
 * on each for the export
 *
 * @param project_id Project ID
 * @param viewID View ID
 * @returns an array of FieldSummary objects
 */
const getNotebookFieldTypes = async (project_id: ProjectID, viewID: string) => {
  const uiSpec = await getEncodedNotebookUISpec(project_id);
  if (!uiSpec) {
    throw new Error("can't find project " + project_id);
  }
  if (!(viewID in uiSpec.viewsets)) {
    throw new Error(`invalid form ${viewID} not found in notebook`);
  }
  const views = uiSpec.viewsets[viewID].views;
  const fields: FieldSummary[] = [];
  views.forEach((view: any) => {
    uiSpec.fviews[view].fields.forEach((field: any) => {
      const fieldInfo = uiSpec.fields[field];
      fields.push({
        name: field,
        type: fieldInfo['type-returned'],
        annotation: fieldInfo.meta.annotation.include
          ? slugify(fieldInfo.meta.annotation.label)
          : '',
        uncertainty: fieldInfo.meta.uncertainty.include
          ? slugify(fieldInfo.meta.uncertainty.label)
          : '',
      });
    });
  });
  return fields;
};

/**
 * Stream the records in a notebook as a CSV file
 *
 * @param projectId Project ID
 * @param viewID View ID
 * @param res writeable stream
 */
export const streamNotebookRecordsAsCSV = async (
  projectId: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
) => {
  console.log('streaming notebook records as CSV', projectId, viewID);
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
  });
  const fields = await getNotebookFieldTypes(projectId, viewID);

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
        record.annotations,
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
        stringifier = stringify({columns, header: true, escape_formulas: true});
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
  projectId: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
) => {
  const logMemory = (stage: string, extraInfo = '') => {
    if (DEVELOPER_MODE) {
      const used = process.memoryUsage();
      console.log(
        `[ZIP ${stage}] ${extraInfo} - RSS: ${Math.round(used.rss / 1024 / 1024)}MB, ArrayBuffers: ${Math.round(used.arrayBuffers / 1024 / 1024)}MB, External: ${Math.round(used.external / 1024 / 1024)}MB`
      );
    }
  };

  logMemory('START');

  let allFilesAdded = false;
  let doneFinalize = false;

  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
  });
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

  let recordCount = 0;
  let fileCount = 0;

  archive.pipe(res);
  let dataWritten = false;
  let {record, done} = await iterator.next();
  const fileNames: string[] = [];
  while (!done) {
    // iterate over the fields, if it's a file, then
    // append it to the archive
    if (record !== null) {
      const hrid = record.hrid || record.record_id;
      recordCount++;
      logMemory('RECORD', `Record ${recordCount} (${hrid})`);

      // Process files sequentially to avoid memory spikes
      for (const key of Object.keys(record.data)) {
        if (record.data[key] instanceof Array && record.data[key].length > 0) {
          if (record.data[key][0] instanceof File) {
            const file_list = record.data[key] as File[];

            // Process files one at a time
            for (const file of file_list) {
              fileCount++;
              const fileSizeMB = Math.round(file.size / 1024 / 1024);
              logMemory(
                'BEFORE_FILE',
                `File ${fileCount}, Size: ${fileSizeMB}MB`
              );

              const filename = generateFilenameForAttachment(
                file,
                key,
                hrid,
                fileNames
              );
              fileNames.push(filename);

              // Convert Web ReadableStream to Node.js Readable stream
              const webStream = file.stream();
              const reader = webStream.getReader();

              // Create a Node.js Readable stream from the chunks
              const nodeStream = new Stream.Readable({
                async read() {
                  try {
                    const {done, value} = await reader.read();
                    if (done) {
                      this.push(null); // End the stream
                    } else {
                      this.push(Buffer.from(value)); // Convert Uint8Array to Buffer
                    }
                  } catch (error) {
                    this.destroy(error as Error);
                  }
                },
              });

              await archive.append(nodeStream, {
                name: filename,
              });
              dataWritten = true;

              logMemory('AFTER_FILE', `File ${fileCount} processed`);
            }

            // Clear the file array after processing to help GC
            record.data[key] = [];
            logMemory('AFTER_CLEAR', 'Files cleared');
            // Force garbage collection if available (Node.js --expose-gc flag)
            if (global.gc && recordCount % 5 === 0) {
              global.gc();
              logMemory('AFTER_GC', `Forced GC after record ${recordCount}`);
            }
          }
        }
      }
    }
    // Clear the record reference before getting the next one
    record = null;

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

  logMemory('COMPLETE');
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
export const getRolesForNotebook = () => {
  return resourceRoles[Resource.PROJECT];
};

export async function countRecordsInNotebook(
  project_id: ProjectID
): Promise<number> {
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
