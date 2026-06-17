import {
  GetNotebookResponse,
  migrateNotebook,
  NotebookDefinition,
  normalizeNotebookUiSpecification,
  UiSpecModel,
} from '@faims3/data-model';
import type {ProjectInformation} from '../projectSlice';

/**
 * Build a {@link NotebookDefinition} from persisted legacy redux fields
 * (`metadata` bag + decoded `rawUiSpecification` with `views`).
 */
export function notebookDefinitionFromLegacyPersistedProject(project: {
  metadata?: Record<string, unknown>;
  rawUiSpecification?: UiSpecModel;
}): NotebookDefinition {
  const legacyMetadata = project.metadata ?? {};
  const raw = project.rawUiSpecification;
  const wire = {
    metadata: legacyMetadata,
    'ui-specification': raw
      ? {
          fields: raw.fields,
          fviews: raw.views,
          viewsets: raw.viewsets,
          visible_types: raw.visible_types ?? [],
        }
      : {fields: {}, fviews: {}, viewsets: {}, visible_types: []},
  };
  return migrateNotebook(wire).migrated;
}

/** Map GET /api/notebooks/:id to store-ready {@link ProjectInformation}. */
export function projectInformationFromGetNotebook(
  notebook: GetNotebookResponse
): ProjectInformation {
  const uiDefinition = normalizeNotebookUiSpecification(
    notebook.uiSpecification
  );
  return {
    name: notebook.name,
    description: notebook.description,
    templateId: notebook.templateId,
    status: notebook.status,
    updatedAt: notebook.updatedAt,
    uiDefinition,
    recordCount: notebook.recordCount,
  };
}
