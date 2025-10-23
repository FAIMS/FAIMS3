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
  DatabaseInterface,
  decodeUiSpec,
  EncodedProjectUIModel,
  ExistingProjectDocument,
  file_attachments_to_data,
  file_data_to_attachments,
  getDataDB,
  GetNotebookListResponse,
  logError,
  PROJECT_METADATA_PREFIX,
  ProjectDBFields,
  ProjectDocument,
  ProjectID,
  ProjectMetadata,
  PROJECTS_BY_TEAM_ID,
  ProjectStatus,
  Resource,
  resourceRoles,
  Role,
  safeWriteDocument,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
  slugify,
  userHasProjectRole,
} from '@faims3/data-model';
import {
  getMetadataDb,
  initialiseDataDb,
  initialiseMetadataDb,
  localGetProjectsDb,
  verifyCouchDBConnection,
} from '.';
import {COUCHDB_PUBLIC_URL} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {userCanDo} from '../middleware';

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
    await projectsDB.put(projectDoc);
  } catch (error) {
    console.log('Error creating project entry in projects database:', error);
    return undefined;
  }

  // Initialise the metadata DB
  const metaDB = await initialiseMetadataDb({
    projectId,
    force: true,
  });

  const payload = {_id: 'ui-specification', ...uispec};
  await safeWriteDocument({
    db: metaDB,
    data: payload satisfies EncodedProjectUIModel,
  });

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
  await safeWriteDocument({db: metaDB, data: payload});
  await writeProjectMetadata(metaDB, metadata);

  // update the name if required
  await changeNotebookName({projectId, name: metadata.name});

  // no need to write design docs for existing projects
  return projectId;
};

/**
 * Updates the notebook status to the targeted value
 */
export const changeNotebookName = async ({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) => {
  // get existing project record
  const project = await getProjectById(projectId);

  if (project.name !== name) {
    // update name
    const updated = {...project, name};

    // write it back
    await putProjectDoc(updated);
  }
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
  metaDB: DatabaseInterface,
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

    await safeWriteDocument({db: metaDB, data: doc});
  }
  // also add the whole metadata as 'projectvalue'
  metadata._id = PROJECT_METADATA_PREFIX + '-projectvalue';
  try {
    const existingDoc = await metaDB.get(metadata._id);
    metadata['_rev'] = existingDoc['_rev'];
  } catch {
    // no existing document, so don't set the rev
  }
  await safeWriteDocument({db: metaDB, data: metadata});
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
      console.error('error reading project metadata', project_id, error);
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
    console.error('error reading metadata db for project', projectId, error);
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
