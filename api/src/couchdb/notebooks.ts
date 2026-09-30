// SPDX-License-Identifier: Apache-2.0

/*
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
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  notebookUiSpecificationNeedsMigration,
  notebookSchemaVersionNeedsMigration,
  type NotebookWithSchemaVersion,
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
  PutUpdateNotebookOfflineMapRegionInput,
  PutUpdateNotebookUiSpecificationInput,
  Resource,
  resourceRoles,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
  slugify,
  NotebookUiSpec,
  normalizeNotebookUiSpecification,
  normalizeRootDescriptionForStore,
  notebookUiSpecificationValidationMessage,
  CompiledNotebookUiSpec,
  compileUiSpecConditionals,
  buildUiSpecProperties,
} from '@faims3/data-model';
import {
  getDataDb,
  getNanoDataDb,
  initialiseDataDb,
  localGetProjectsDb,
  registerDataDbAtCurrentVersion,
  unregisterDataDbMigration,
  verifyCouchDBConnection,
} from '.';
import {config} from '../buildconfig';
import * as Exceptions from '../exceptions';
import {userCanDo} from '../middleware';
import {nowIso} from '../time';

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
  const projects = await getAllProjectsListing();
  return projects
    .filter(project => project.templateId === templateId)
    .map(project => project._id);
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

/** Stamp the public Couch URL so listing clients can open the data DB. */
export function stampListingCouchUrl<T extends ProjectListItem>(project: T): T {
  if (!project.dataDb) {
    return project;
  }
  return {
    ...project,
    dataDb: {
      ...project.dataDb,
      base_url: config.couchdbPublicUrl,
    },
  };
}

/**
 * Lists every project via the listing view (no `uiSpecification`).
 * Stamps `dataDb.base_url` so field-app directory clients can open Couch.
 */
export const getAllProjectsListing = async (): Promise<ProjectListItem[]> => {
  const projectsDb = localGetProjectsDb();
  try {
    const resultList = await projectsDb.query<ProjectListItem>(
      PROJECTS_LISTING_BY_PROJECT_ID,
      {include_docs: false}
    );
    return resultList.rows
      .filter(row => row.value != null && row.id && !row.id.startsWith('_'))
      .map(row => stampListingCouchUrl({...row.value!}));
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading the project listing from the Project DB.'
    );
  }
};

/**
 * How many projects {@link getUserProjectsListing} resolves per batch when
 * computing each project's `byteCount`. Each `byteCount` costs one CouchDB
 * `info()` call, so this caps the concurrent `info()` round-trips and stops a
 * user/team with many notebooks from opening one connection per project at once
 * and exhausting CouchDB's connection limits.
 */
const BYTE_COUNT_BATCH_SIZE = 10;

/** Filters for {@link getUserProjectsListing}. `byteCount` is off by default. */
export type GetUserProjectsListingOptions = {
  teamId?: string;
  includeArchived?: boolean;
  includeByteCount?: boolean;
};

/**
 * Lean listing of notebooks the user can read. Shared by `GET /api/notebooks`
 * and `GET /api/directory`. Uses listing views (`include_docs: false`) so the
 * form payload is never loaded. `byteCount` is opt-in — it costs one Couch
 * `info()` per project.
 */
export const getUserProjectsListing = async (
  user: Express.User,
  options: GetUserProjectsListingOptions = {}
): Promise<APINotebookList[]> => {
  const {teamId, includeArchived = false, includeByteCount = false} = options;
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
          }
        );
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading projects from the Project DB.'
    );
  }

  const userProjects = resultList.rows
    .filter(row => row.value != null && row.id && !row.id.startsWith('_'))
    .map(row => stampListingCouchUrl({...row.value!}))
    .filter(project => {
      if (!includeArchived && project.status === ProjectStatus.ARCHIVED) {
        return false;
      }
      return userCanDo({
        action: Action.READ_PROJECT_METADATA,
        resourceId: project._id,
        user,
      });
    });

  if (!includeByteCount) {
    return userProjects;
  }

  const detailed: APINotebookList[] = [];
  for (let p = 0; p < userProjects.length; p += BYTE_COUNT_BATCH_SIZE) {
    const batch = userProjects.slice(p, p + BYTE_COUNT_BATCH_SIZE);
    detailed.push(
      ...(await Promise.all(
        batch.map(async project => ({
          ...project,
          byteCount: await getByteCount(project._id),
        }))
      ))
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
  return getNotebookSchemaVersion(raw as NotebookWithSchemaVersion) ?? 'none';
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
      targetSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });

    const report = await verifyCouchDBConnection();

    if (!report.valid) {
      logNotebookStartup('aborted', {reason: 'couchdb_connection_invalid'});
      return report;
    }

    const projects = await getAllProjectsListing();
    logNotebookStartup('projects_loaded', {count: projects.length});

    for (const project of projects) {
      const projectId = project._id;
      const projectName = project.name;
      const listedVersion = project.uiSpecProperties?.schemaVersion;

      if (
        listedVersion &&
        !notebookSchemaVersionNeedsMigration(listedVersion)
      ) {
        uiSpecCounts.up_to_date++;
        logNotebookStartup('ui_spec', {
          outcome: 'up_to_date',
          projectId,
          projectName,
          schemaVersion: listedVersion,
        });
      } else {
        const full = await getProjectById(projectId);
        const raw = full.uiSpecification;
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
    uiSpecProperties: await buildUiSpecProperties(normalizedUiSpecification),
  } satisfies ProjectDocument;

  try {
    await registerDataDbAtCurrentVersion({
      project: projectDoc,
      launchedBy: createdBy,
    });
  } catch (error) {
    console.error(
      `Failed to register data DB migration for new survey ${projectId}:`,
      error
    );
    throw new Exceptions.InternalSystemError(
      `Failed to register data DB migration for new survey ${projectId}.`
    );
  }

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
 * Merges inconsequential root fields on an existing project
 * (name, description, disableQuickShare).
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
  if (payload.disableQuickShare !== undefined) {
    updated.disableQuickShare = payload.disableQuickShare;
  }
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
    uiSpecProperties: await buildUiSpecProperties(normalizedUiSpecification),
    updatedAt: nowIso(),
  };
  await putProjectDoc(updated);
  return getProjectById(projectId);
};

/**
 * Sets or clears the recommended offline map region on a project document.
 *
 * Passing `offlineMapRegion: null` removes the field from CouchDB so GET
 * responses omit it rather than returning an explicit null.
 */
export const updateProjectOfflineMapRegion = async (
  projectId: string,
  input: PutUpdateNotebookOfflineMapRegionInput
): Promise<ExistingProjectDocument> => {
  const {offlineMapRegion} = input;
  const project = await getProjectById(projectId);
  const updated: ProjectDocument = {
    ...project,
    updatedAt: nowIso(),
  };
  if (offlineMapRegion == null) {
    delete updated.offlineMapRegion;
  } else {
    updated.offlineMapRegion = offlineMapRegion;
  }
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

  const dataDB = await getDataDb(project_id);
  await dataDB.destroy();

  // remove the project from the projectsDB
  await projectsDB.remove(projectDoc);

  try {
    await unregisterDataDbMigration({project: projectDoc});
  } catch (error) {
    console.error(
      `Failed to remove migration document for deleted survey ${project_id}:`,
      error
    );
  }
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
export async function getByteCount(project_id: ProjectID): Promise<number> {
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
