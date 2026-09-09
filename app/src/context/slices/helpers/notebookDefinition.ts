import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  GetNotebookResponse,
  ingestNotebookUiSpecification,
  migrateNotebook,
  NotebookDefinition,
  NotebookSchemaCompatibility,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Placeholder definition stored when a notebook's design cannot be
 * interpreted by this build (incompatible schema, failed migration, invalid
 * document). The form graph is empty so nothing renders as a form; design
 * metadata is salvaged loosely when present so the skeleton view can still
 * show purpose / lead / institution.
 *
 * Consumers must check `Project.schemaCompatibility.tier === 'incompatible'`
 * rather than inspecting this placeholder.
 */
export function placeholderNotebookDefinition(
  raw?: unknown
): NotebookDefinition {
  const rawMeta =
    isPlainObject(raw) && isPlainObject(raw.metadata) ? raw.metadata : {};
  const rawInfo = isPlainObject(rawMeta.information) ? rawMeta.information : {};
  const rawUiSpec =
    isPlainObject(raw) && isPlainObject(raw.uiSpec) ? raw.uiSpec : {};
  const rawSettings = isPlainObject(rawUiSpec.settings)
    ? rawUiSpec.settings
    : {};

  return {
    uiSpec: {
      fields: {},
      views: {},
      viewsets: {},
      visible_types: [],
      settings: {
        showQrCodeButton: rawSettings.showQrCodeButton === true,
      },
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    },
    metadata: {
      information: {
        notebookVersion: stringOrEmpty(rawInfo.notebookVersion),
        purposeMarkdown: stringOrEmpty(rawInfo.purposeMarkdown),
        projectLeadLabel: stringOrEmpty(rawInfo.projectLeadLabel),
        leadInstitution: stringOrEmpty(rawInfo.leadInstitution),
        ...(typeof rawInfo.derivedFromTemplateId === 'string'
          ? {derivedFromTemplateId: rawInfo.derivedFromTemplateId}
          : {}),
      },
      ...(isPlainObject(rawMeta.custom) ? {custom: rawMeta.custom} : {}),
    },
  };
}

/**
 * Fail-soft ingest of a `uiSpecification` payload for the app store.
 *
 * Never throws for a schema mismatch: returns the parsed (or best-effort)
 * definition plus the compatibility tier, or a placeholder definition with an
 * `incompatible` tier whose `reason` explains why.
 */
export function ingestNotebookDefinitionForStore(raw: unknown): {
  uiDefinition: NotebookDefinition;
  schemaCompatibility: NotebookSchemaCompatibility;
} {
  const result = ingestNotebookUiSpecification(raw, {
    context: {launchedBy: 'app-ingest'},
  });
  if (result.ok) {
    return {
      uiDefinition: result.definition,
      schemaCompatibility: result.compatibility,
    };
  }
  return {
    uiDefinition: placeholderNotebookDefinition(raw),
    schemaCompatibility: result.compatibility,
  };
}

/** Map GET /api/notebooks/:id to store-ready {@link ProjectInformation}. */
export function projectInformationFromGetNotebook(
  notebook: GetNotebookResponse
): ProjectInformation {
  const {uiDefinition, schemaCompatibility} = ingestNotebookDefinitionForStore(
    notebook.uiSpecification
  );
  return {
    name: notebook.name,
    description: notebook.description,
    templateId: notebook.templateId,
    status: notebook.status,
    updatedAt: notebook.updatedAt,
    uiDefinition,
    schemaCompatibility,
    recordCount: notebook.recordCount,
    offlineMapRegion: notebook.offlineMapRegion,
  };
}
