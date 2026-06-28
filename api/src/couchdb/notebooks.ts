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
  ExistingProjectDocument,
  file_attachments_to_data,
  file_data_to_attachments,
  getDataDB,
  GetNotebookListResponse,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  notebookUiSpecificationNeedsMigration,
  NotebookDefinition,
  NotebookUiSpecificationInput,
  ProjectDBFields,
  ProjectDocument,
  ProjectID,
  PROJECTS_BY_TEAM_ID,
  PROJECTS_LISTING_BY_PROJECT_ID,
  PROJECTS_LISTING_BY_TEAM_ID,
  ProjectListItem,
  ProjectStatus,
  PutUpdateNotebookMetadataInput,
  PutUpdateNotebookUiSpecificationInput,
  Resource,
  resourceRoles,
  Role,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
  slugify,
  userHasProjectRole,
  NotebookUiSpec,
  normalizeNotebookUiSpecification,
  normalizeRootDescriptionForStore,
  notebookUiSpecificationValidationMessage,
  CompiledNotebookUiSpec,
  compileUiSpecConditionals,
} from '@faims3/data-model';
import {
  getNanoDataDb,
  initialiseDataDb,
  localGetProjectsDb,
  verifyCouchDBConnection,
} from '.';
import {COUCHDB_PUBLIC_URL, MIGRATE_NOTEBOOKS_ON_STARTUP} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {userCanDo} from '../middleware';
import {nowIso} from '../time';
import { use } from "chai";

/**
 * Migrate legacy notebook JSON when needed, validate as {@link NotebookDefinition},
 * and map failures to {@link Exceptions.ValidationException}.
 */
export function normalizeUiSpecificationOrThrow(
  raw: unknown
): NotebookDefinition {
  try {
    return normalizeNotebookUiSpecification(raw);
  } catch (error) {
    throw new Exceptions.ValidationException(
      notebookUiSpecificationValidationMessage(error)
    );
  }
}

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
 * Returns project (survey) IDs whose directory document references the given
 * template (`templateId` on the project document).
 */
export const getProjectIdsReferencingTemplate = async (
  templateId: string
): Promise<string[]> => {
  const projectsDb = localGetProjectsDb();
  const res = await projectsDb.allDocs<ProjectDocument>({
    include_docs: true,
  });
  const ids: string[] = [];
  for (const row of res.rows) {
    const doc = row.doc;
    if (!doc || row.id.startsWith('_')) {
      continue;
    }
    if (doc.templateId === templateId) {
      ids.push(doc._id);
    }
  }
  return ids;
};

/**
 * Clears `templateId` on all project documents that reference the template.
 * Used when permanently deleting a template so surveys do not keep stale
 * references.
 */
export const clearTemplateIdFromProjectsReferencingTemplate = async (
  templateId: string
): Promise<void> => {
  const projectIds = await getProjectIdsReferencingTemplate(templateId);
  const projectsDb = localGetProjectsDb();
  for (const projectId of projectIds) {
    const doc = await projectsDb.get(projectId);
    if (doc.templateId !== templateId) {
      continue;
    }
    const updated: ProjectDocument = {...doc};
    delete updated.templateId;
    await putProjectDoc(updated);
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
  user: Express.User,
  includeArchived = false
): Promise<ProjectDocument[]> => {
  return (await getAllProjectsDirectory()).filter(p => {
    if (!includeArchived && p.status === ProjectStatus.ARCHIVED) {
      return false;
    }
    return userCanDo({
      user,
      action: Action.READ_PROJECT_METADATA,
      resourceId: p._id,
    });
  });
};

/**
 * How many projects {@link getUserProjectsDetailed} resolves per batch when
 * computing each project's `byteCount`. Each `byteCount` costs one CouchDB
 * `info()` call, so this caps the concurrent `info()` round-trips and stops a
 * user/team with many notebooks from opening one connection per project at once
 * and exhausting CouchDB's connection limits.
 */
const BYTE_COUNT_BATCH_SIZE = 10;

/**
 * Lists notebooks using CouchDB views whose map `value` is the project doc
 * without `uiSpecification`. Uses `include_docs: false` on purpose: with
 * `include_docs: true`, CouchDB would also attach the full stored document for
 * each row (including `uiSpecification`), which would defeat the lean list.
 *
 * @param user - only return notebooks that this user can see
 * @returns notebook list rows (from each row's `value`) plus `is_admin` and `byteCount`
 */
export const getUserProjectsDetailed = async (
  user: Express.User,
  teamId: string | undefined = undefined,
  includeArchived = false,
): Promise<APINotebookList[]> => {
  const projectsDb = localGetProjectsDb();

  let resultList;
  try {
    resultList = teamId
      ? await projectsDb.query<ProjectListItem>(PROJECTS_LISTING_BY_TEAM_ID, {
          key: teamId,
          include_docs: false,
        })
      : await projectsDb.query<ProjectListItem>(
          PROJECTS_LISTING_BY_PROJECT_ID,
          {
            include_docs: false,
          },
        );
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      "An error occurred while reading projects from the Project DB.",
    );
  }

  const userProjects = resultList.rows
    .filter((row) => row.value != null && row.id && !row.id.startsWith("_"))
    .map((row) => row.value!)
    .filter((project) => {
      if (!includeArchived && project.status === ProjectStatus.ARCHIVED) {
        return false;
      }
      return userCanDo({
        action: Action.READ_PROJECT_METADATA,
        resourceId: project._id,
        user,
      });
    });

  const detailed: APINotebookList[] = [];
  for (let p = 0; p < userProjects.length; p += BYTE_COUNT_BATCH_SIZE) {
    const batch = userProjects.slice(p, p + BYTE_COUNT_BATCH_SIZE);
    detailed.push(
      ...(await Promise.all(
        batch.map(async (project) => {
          const projectId = project._id;
          return {
            ...project,
            is_admin: userHasProjectRole({
              user,
              projectId,
              role: Role.PROJECT_ADMIN,
            }),
            byteCount: await getByteCount(projectId),
          };
        }),
      )),
    );
  }
  return detailed;
};

/**
 * Generate a good project identifier for a new project
 * @param projectName the project name string
 * @returns a suitable project identifier
 */
const generateProjectID = (projectName: string): ProjectID => {
  return `${Date.now().toFixed()}-${slugify(projectName)}`;
};

const NOTEBOOK_STARTUP_LOG = '[notebook-startup]';

type NotebookStartupUiSpecOutcome =
  | 'migrated'
  | 'up_to_date'
  | 'skipped_no_ui_spec'
  | 'skipped_invalid_ui_spec';

function logNotebookStartup(
  event: string,
  fields: Record<string, string | number | boolean | undefined>
): void {
  const detail = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.log(
    detail.length > 0
      ? `${NOTEBOOK_STARTUP_LOG} ${event} ${detail}`
      : `${NOTEBOOK_STARTUP_LOG} ${event}`
  );
}

function isUiSpecificationObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function schemaVersionLabel(raw: Record<string, unknown>): string {
  return getNotebookSchemaVersion(raw) ?? 'none';
}

/**
 * validateDatabases - check that all notebook databases are set up
 *  properly, add design documents if they are missing
 */
export const validateDatabases = async () => {
  const uiSpecCounts: Record<NotebookStartupUiSpecOutcome, number> = {
    migrated: 0,
    up_to_date: 0,
    skipped_no_ui_spec: 0,
    skipped_invalid_ui_spec: 0,
  };

  try {
    logNotebookStartup('begin', {
      migrateNotebooksOnStartup: MIGRATE_NOTEBOOKS_ON_STARTUP,
      targetSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });

    const report = await verifyCouchDBConnection();

    if (!report.valid) {
      logNotebookStartup('aborted', {reason: 'couchdb_connection_invalid'});
      return report;
    }

    const projects = await getAllProjectsDirectory();
    logNotebookStartup('projects_loaded', {count: projects.length});

    if (!MIGRATE_NOTEBOOKS_ON_STARTUP) {
      logNotebookStartup('ui_spec_migration_skipped', {
        reason: 'MIGRATE_NOTEBOOKS_ON_STARTUP=false',
      });
    }

    for (const project of projects) {
      const projectId = project._id;
      const projectName = project.name;

      if (MIGRATE_NOTEBOOKS_ON_STARTUP) {
        const raw = project.uiSpecification;
        if (raw == null) {
          uiSpecCounts.skipped_no_ui_spec++;
          logNotebookStartup('ui_spec', {
            outcome: 'skipped_no_ui_spec',
            projectId,
            projectName,
          });
        } else if (!isUiSpecificationObject(raw)) {
          uiSpecCounts.skipped_invalid_ui_spec++;
          logNotebookStartup('ui_spec', {
            outcome: 'skipped_invalid_ui_spec',
            projectId,
            projectName,
          });
        } else if (notebookUiSpecificationNeedsMigration(raw)) {
          const fromSchemaVersion = schemaVersionLabel(raw);
          await updateProjectUiSpecification(projectId, raw);
          uiSpecCounts.migrated++;
          logNotebookStartup('ui_spec', {
            outcome: 'migrated',
            projectId,
            projectName,
            fromSchemaVersion,
            toSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
          });
        } else {
          uiSpecCounts.up_to_date++;
          logNotebookStartup('ui_spec', {
            outcome: 'up_to_date',
            projectId,
            projectName,
            schemaVersion: schemaVersionLabel(raw),
          });
        }
      }

      await initialiseDataDb({
        projectId,
        force: true,
      });
    }

    logNotebookStartup('complete', {
      projects: projects.length,
      migrateNotebooksOnStartup: MIGRATE_NOTEBOOKS_ON_STARTUP,
      uiSpecMigrated: uiSpecCounts.migrated,
      uiSpecUpToDate: uiSpecCounts.up_to_date,
      uiSpecSkippedNoUiSpec: uiSpecCounts.skipped_no_ui_spec,
      uiSpecSkippedInvalidUiSpec: uiSpecCounts.skipped_invalid_ui_spec,
    });

    return report;
  } catch (e) {
    console.error(`${NOTEBOOK_STARTUP_LOG} failed`, e);
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
export const createNotebook = async ({
  projectName,
  uiSpecification,
  description = '',
  templateId,
  teamId,
  createdBy,
}: {
  projectName: string;
  uiSpecification: NotebookDefinition | NotebookUiSpecificationInput;
  description?: string;
  templateId?: string;
  teamId?: string;
  createdBy: string;
}) => {
  const normalizedUiSpecification =
    normalizeUiSpecificationOrThrow(uiSpecification);
  const projectId = generateProjectID(projectName);
  const dataDBName = `data-${projectId}`;
  const now = nowIso();
  const storedDescription = normalizeRootDescriptionForStore(description);
  const projectDoc = {
    _id: projectId,
    name: projectName.trim(),
    ...(storedDescription !== undefined
      ? {description: storedDescription}
      : {}),
    templateId,
    dataDb: {
      db_name: dataDBName,
    },
    status: ProjectStatus.OPEN,
    ownedByTeamId: teamId,
    createdBy,
    createdAt: now,
    updatedAt: now,
    uiSpecification: normalizedUiSpecification,
  } satisfies ProjectDocument;

  try {
    // first add an entry to the projects db about this project
    const projectsDB = localGetProjectsDb();
    await projectsDB.put(projectDoc);
  } catch (error) {
    console.log('Error creating project entry in projects database:', error);
    return undefined;
  }

  await initialiseDataDb({
    projectId,
    force: true,
  });

  return projectId;
};

/**
 * Merges inconsequential root fields on an existing project (name, description).
 */
export const updateProjectMetadata = async (
  projectId: string,
  payload: PutUpdateNotebookMetadataInput
): Promise<ExistingProjectDocument> => {
  const project = await getProjectById(projectId);
  const updated: ProjectDocument = {
    ...project,
    name: payload.name ?? project.name,
    description:
      payload.description !== undefined
        ? normalizeRootDescriptionForStore(payload.description)
        : project.description,
    updatedAt: nowIso(),
  };
  await putProjectDoc(updated);
  return getProjectById(projectId);
};

/**
 * Replaces the full uiSpecification bundle on a project.
 */
export const updateProjectUiSpecification = async (
  projectId: string,
  uiSpecification:
    | PutUpdateNotebookUiSpecificationInput
    | NotebookUiSpecificationInput
): Promise<ExistingProjectDocument> => {
  const normalizedUiSpecification =
    normalizeUiSpecificationOrThrow(uiSpecification);
  const project = await getProjectById(projectId);
  const updated: ProjectDocument = {
    ...project,
    uiSpecification: normalizedUiSpecification,
    updatedAt: nowIso(),
  };
  await putProjectDoc(updated);
  return getProjectById(projectId);
};

/**
 * Apply a lifecycle status change to an already-loaded project document.
 * Used by PUT /api/notebooks/:id/status after authorization.
 */
export const applyNotebookLifecycleStatus = async (
  project: ProjectDocument,
  targetStatus: ProjectStatus
): Promise<void> => {
  if (
    targetStatus === ProjectStatus.OPEN &&
    project.status === ProjectStatus.ARCHIVED
  ) {
    throw new Exceptions.InvalidRequestException(
      'Cannot open an archived survey. Restore it from the archive first.'
    );
  }

  if (project.status === targetStatus) {
    return;
  }

  await putProjectDoc({
    ...project,
    status: targetStatus,
    updatedAt: nowIso(),
  });
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
  const updated = {...project, ownedByTeamId: teamId, updatedAt: nowIso()};
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

  const dataDB = await getDataDB(project_id);
  await dataDB.destroy();

  // remove the project from the projectsDB
  await projectsDB.remove(projectDoc);
};

/**
 * Gets the ready to use representation of the UI spec for a given project.
 *
 * @param projectId
 * @returns The decoded project UI model (not compiled)
 */
export const getUiSpecModel = async (
  projectId: string
): Promise<NotebookUiSpec> => {
  const project = await getProjectById(projectId);
  return project.uiSpecification.uiSpec;
};

/**
 * Gets the ready to use compiled ui specification for a given project.
 *
 * @param projectId
 * @returns The decoded project UI model (compiled)
 */
export const getCompiledUiSpecModel = async (
  projectId: string
): Promise<CompiledNotebookUiSpec> => {
  const uncompiled = await getUiSpecModel(projectId);
  compileUiSpecConditionals(uncompiled);
  return uncompiled as CompiledNotebookUiSpec;
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

/** Project-scoped roles from the permission model (not stored in Couch metadata DBs). */
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

/**
 * Returns the storage size in bytes of a notebook's data database.
 *
 * PouchDB does not surface database sizes, so this uses CouchDB's GET /{db}
 * info endpoint via nano. `sizes.active` is the size of the live data, matching
 * the value shown in CouchDB Fauxton. (Use `sizes.file` instead if you want the
 * on-disk size including view indexes and not-yet-compacted revisions.)
 */
export async function getByteCount(
  project_id: ProjectID
): Promise<number> {
  try {
    const dataDb = await getNanoDataDb(project_id);
    const info = await dataDb.info();
    return info.sizes.active;
  } catch (error) {
    console.error(error);
    return -1;
  }
}

/*
 * For saving and loading attachment with type faims-attachment::Files
 */

setAttachmentLoaderForType('faims-attachment::Files', file_attachments_to_data);
setAttachmentDumperForType('faims-attachment::Files', file_data_to_attachments);
