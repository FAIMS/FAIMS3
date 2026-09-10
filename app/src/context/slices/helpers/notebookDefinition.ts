import {
  assessNotebookSchemaCompatibility,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  GetNotebookResponse,
  ingestNotebookUiSpecification,
  migrateNotebook,
  NotebookDefinition,
  NotebookSchemaCompatibility,
  UiSpecModel,
} from '@faims3/data-model';
import {config} from '../../../buildconfig';
import type {Project, ProjectInformation} from '../projectSlice';

/** Legacy redux fields persisted before `uiDefinition` existed. */
type LegacyPersistedNotebookFields = {
  metadata?: Record<string, unknown>;
  rawUiSpecification?: UiSpecModel;
};

/** Rebuild the legacy wire shape `{metadata, 'ui-specification'}` from persisted fields. */
function legacyPersistedProjectToWire(project: LegacyPersistedNotebookFields) {
  const legacyMetadata = project.metadata ?? {};
  const raw = project.rawUiSpecification;
  return {
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
}

/**
 * Build a {@link NotebookDefinition} from persisted legacy redux fields
 * (`metadata` bag + decoded `rawUiSpecification` with `views`). Throws when the
 * collapse migration or validation fails; prefer
 * {@link ingestLegacyPersistedProjectForStore} on the persist path.
 */
export function notebookDefinitionFromLegacyPersistedProject(
  project: LegacyPersistedNotebookFields
): NotebookDefinition {
  return migrateNotebook(legacyPersistedProjectToWire(project)).migrated;
}

/**
 * Fail-soft variant of {@link notebookDefinitionFromLegacyPersistedProject}:
 * the legacy wire goes through {@link ingestNotebookDefinitionForStore}, so an
 * unreadable design yields a placeholder plus an `incompatible` tier instead of
 * dropping the project from persisted state.
 */
export function ingestLegacyPersistedProjectForStore(
  project: LegacyPersistedNotebookFields
): {
  uiDefinition: NotebookDefinition;
  schemaCompatibility: NotebookSchemaCompatibility;
} {
  return ingestNotebookDefinitionForStore(
    legacyPersistedProjectToWire(project)
  );
}

/**
 * True when a stored definition is the empty placeholder written for an
 * unreadable design (see {@link placeholderNotebookDefinition}) rather than a
 * real form graph. Used to decide whether local records can still be browsed.
 */
export function isPlaceholderNotebookDefinition(
  definition: NotebookDefinition | undefined
): boolean {
  const uiSpec = definition?.uiSpec;
  if (!uiSpec) return true;
  return (
    Object.keys(uiSpec.fields ?? {}).length === 0 &&
    Object.keys(uiSpec.views ?? {}).length === 0 &&
    Object.keys(uiSpec.viewsets ?? {}).length === 0
  );
}

/**
 * True when this build must not accept new data against the notebook's
 * design: the server's design is `incompatible` (newer major, failed
 * migration or invalid). Existing local records may still be viewed through
 * the last good definition, but create and edit are blocked.
 */
export function isNotebookDesignLocked(
  project: Pick<Project, 'schemaCompatibility'> | undefined
): boolean {
  return project?.schemaCompatibility?.tier === 'incompatible';
}

/**
 * Block first activation when this build cannot interpret the design and
 * there is no last-good graph on the device (newer major or failed parse).
 * Already-activated notebooks keep their sync controls. A last-good graph
 * may be re-activated so local data is not trapped.
 */
export function isNotebookActivationBlocked(
  project:
    | Pick<Project, 'schemaCompatibility' | 'uiDefinition'>
    | undefined
): boolean {
  return (
    isNotebookDesignLocked(project) &&
    isPlaceholderNotebookDefinition(project?.uiDefinition)
  );
}

/**
 * Re-evaluate a persisted project's compatibility against **this** build.
 *
 * `schemaCompatibility` is written by whichever app version last fetched the
 * notebook. After an app upgrade or downgrade (especially offline) that tier
 * is stale, so on startup every project is reassessed:
 *
 * - Already assessed by this build (`appSchemaVersion === CURRENT`): no-op.
 * - Previously `incompatible`: the stored `uiDefinition` is a placeholder or the
 *   last good design, not the server's. Re-classify the server's version; if a
 *   newer build could now read it, stay `incompatible` (with a "refresh" reason)
 *   until the design is actually downloaded — never promote without the graph.
 * - Otherwise (`compatible` / `degraded` / never assessed): re-ingest the stored
 *   definition. An older epoch version is migrated; a newer minor becomes
 *   `degraded`; a newer major (app downgrade) becomes `incompatible` while the
 *   stored graph is kept for read-only access, mirroring `initialiseProjects`.
 */
export function reassessPersistedNotebookDefinition(
  project: Pick<Project, 'uiDefinition' | 'schemaCompatibility'>
): {
  uiDefinition: NotebookDefinition;
  schemaCompatibility: NotebookSchemaCompatibility;
  changed: boolean;
} {
  const stored = project.schemaCompatibility;
  if (stored?.appSchemaVersion === CURRENT_NOTEBOOK_UI_SCHEMA_VERSION) {
    return {
      uiDefinition: project.uiDefinition,
      schemaCompatibility: stored,
      changed: false,
    };
  }

  if (stored?.tier === 'incompatible') {
    const next = assessNotebookSchemaCompatibility(
      stored.notebookSchemaVersion
    );
    if (next.tier !== 'incompatible') {
      return {
        uiDefinition: project.uiDefinition,
        schemaCompatibility: {
          ...next,
          tier: 'incompatible',
          reason: `${next.reason} This ${config.notebookName} design was not stored on this device by the previous app version; refresh the ${config.notebookName} list to download it.`,
        },
        changed: true,
      };
    }
    return {
      uiDefinition: project.uiDefinition,
      schemaCompatibility: next,
      changed: true,
    };
  }

  const ingested = ingestNotebookDefinitionForStore(project.uiDefinition);
  if (
    ingested.schemaCompatibility.tier === 'incompatible' &&
    !isPlaceholderNotebookDefinition(project.uiDefinition)
  ) {
    // App downgrade: keep the stored (newer) graph for read-only access.
    return {
      uiDefinition: project.uiDefinition,
      schemaCompatibility: ingested.schemaCompatibility,
      changed: true,
    };
  }
  return {...ingested, changed: true};
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
