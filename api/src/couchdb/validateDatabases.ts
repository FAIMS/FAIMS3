// SPDX-License-Identifier: Apache-2.0
/**
 * @file API-boot orchestration for notebook JSON migrations.
 *
 * Called from `runStartupMigrations` after Couch DB init/migrate (under
 * the clustered startup lock when `STARTUP_MIGRATION_LOCK_ENABLED` is
 * on). Walks every project and every template (including
 * archived) and, when the listing
 * digest is behind `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`, rewrites the stored
 * `uiSpecification` through the normal write helpers so `uiSpecProperties`
 * (`schemaVersion` + hash) is rebuilt in the same document update.
 *
 * Lives in this module — not `notebooks.ts` — so startup can import both
 * `notebooks` and `templates` without a cycle (`templates` already imports
 * `createNotebook`). The per-document decision tree is
 * `migrateStoredUiSpecificationIfNeeded` in `uiSpecificationStartup.ts`.
 *
 * This is not a Couch DB version bump. Newer-than-current designs are left
 * untouched. A failed walk logs and returns `{valid: false}` so the full API
 * can still attach; a bad Couch connection aborts the walks entirely.
 */
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {initialiseDataDb, verifyCouchDBConnection} from '.';
import {
  getAllProjectsListing,
  getProjectById,
  updateProjectUiSpecification,
} from './notebooks';
import {
  getTemplate,
  getTemplates,
  updateTemplateUiSpecification,
} from './templates';
import {
  emptyNotebookStartupUiSpecCounts,
  logNotebookStartup,
  migrateStoredUiSpecificationIfNeeded,
  NOTEBOOK_STARTUP_LOG,
  type NotebookStartupUiSpecCounts,
} from './uiSpecificationStartup';

/**
 * Walk the projects listing. Each behind-schema survey is persisted through
 * {@link updateProjectUiSpecification}. Always re-inits the per-project data
 * DB (design docs), whether or not the uiSpec changed.
 */
export async function migrateProjectUiSpecificationsOnStartup(): Promise<{
  count: number;
  outcomes: NotebookStartupUiSpecCounts;
}> {
  const projects = await getAllProjectsListing();
  logNotebookStartup('projects_loaded', {count: projects.length});
  const outcomes = emptyNotebookStartupUiSpecCounts();
  for (const project of projects) {
    await migrateStoredUiSpecificationIfNeeded({
      listedVersion: project.uiSpecProperties?.schemaVersion,
      fetchRaw: async () => (await getProjectById(project._id)).uiSpecification,
      persist: raw => updateProjectUiSpecification(project._id, raw),
      logContext: {
        kind: 'project',
        projectId: project._id,
        projectName: project.name,
      },
      counts: outcomes,
    });
    await initialiseDataDb({
      projectId: project._id,
      force: true,
    });
  }
  return {count: projects.length, outcomes};
}

/**
 * Walk the templates listing (same decision tree as surveys). Behind-schema
 * designs are persisted through {@link updateTemplateUiSpecification}, which
 * also increments the template `version`. Includes archived templates.
 */
export async function migrateTemplateUiSpecificationsOnStartup(): Promise<{
  count: number;
  outcomes: NotebookStartupUiSpecCounts;
}> {
  const templates = await getTemplates({});
  logNotebookStartup('templates_loaded', {count: templates.length});
  const outcomes = emptyNotebookStartupUiSpecCounts();
  for (const template of templates) {
    await migrateStoredUiSpecificationIfNeeded({
      listedVersion: template.uiSpecProperties?.schemaVersion,
      fetchRaw: async () => (await getTemplate(template._id)).uiSpecification,
      persist: raw => updateTemplateUiSpecification(template._id, raw),
      logContext: {
        kind: 'template',
        templateId: template._id,
        templateName: template.name,
      },
      counts: outcomes,
    });
  }
  return {count: templates.length, outcomes};
}

/**
 * Notebook half of API boot (after DB init/migrate under the startup lock):
 * verify Couch, then migrate project and template uiSpecs. Logs
 * `[notebook-startup] begin` / `complete` (or `aborted` / `failed`). Returns
 * the Couch validity report; on walk errors, `{valid: false}`.
 */
export const validateDatabases = async () => {
  try {
    logNotebookStartup('begin', {
      targetSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });

    const report = await verifyCouchDBConnection();

    if (!report.valid) {
      logNotebookStartup('aborted', {reason: 'couchdb_connection_invalid'});
      return report;
    }

    const projects = await migrateProjectUiSpecificationsOnStartup();
    const templates = await migrateTemplateUiSpecificationsOnStartup();

    logNotebookStartup('complete', {
      projects: projects.count,
      uiSpecMigrated: projects.outcomes.migrated,
      uiSpecUpToDate: projects.outcomes.up_to_date,
      uiSpecSkippedNoUiSpec: projects.outcomes.skipped_no_ui_spec,
      uiSpecSkippedInvalidUiSpec: projects.outcomes.skipped_invalid_ui_spec,
      templates: templates.count,
      templateUiSpecMigrated: templates.outcomes.migrated,
      templateUiSpecUpToDate: templates.outcomes.up_to_date,
      templateUiSpecSkippedNoUiSpec: templates.outcomes.skipped_no_ui_spec,
      templateUiSpecSkippedInvalidUiSpec:
        templates.outcomes.skipped_invalid_ui_spec,
    });

    return report;
  } catch (e) {
    console.error(`${NOTEBOOK_STARTUP_LOG} failed`, e);
    return {valid: false};
  }
};
