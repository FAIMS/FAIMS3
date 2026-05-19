import {
  PROJECT_METADATA_PREFIX,
  UI_SPECIFICATION_NAME,
} from '../../datamodel/database';
import {DatabaseInterface, ProjectUIModel} from '../../types';
import type {NotebookDefinition, NotebookUiSpec} from '../../uiSpecification/types';
import {
  EncodedUISpecification,
  EncodedUISpecificationSchema,
} from '../templatesDB/types';
import {migrateNotebook} from './notebookMigrations';

/** Loose metadata bag as stored on templates or merged from the metadata DB. */
export type LegacyNotebookMetadata = Record<string, unknown>;

/** Max length for root `Project.description` / `Template.description` from `pre_description`. */
export const OLD_DESCRIPTION_MAX_LENGTH = 500;

/** Keys mapped into {@link NotebookDefinition} — not copied to `custom`. */
const LEGACY_KEYS_MAPPED = new Set([
  'pre_description',
  'project_lead',
  'lead_institution',
  'notebook_version',
  'schema_version',
  'derived-from',
  'showQRCodeButton',
  'name',
  'template_id',
  'project_id',
  'project_status',
  'projectvalue',
  'description',
]);

/**
 * Legacy keys dropped entirely (not promoted to `metadata.custom`).
 * See metadata-design.md “intentionally removed”.
 */
const LEGACY_KEYS_DROPPED = new Set([
  'access',
  'accesses',
  'behaviours',
  'filenames',
  'forms',
  'ispublic',
  'isrequest',
  'meta',
  'sections',
]);

export function emptyEncodedUiSpec(): EncodedUISpecification {
  return {fields: {}, fviews: {}, viewsets: {}, visible_types: []};
}

/**
 * Converts legacy encoded UI spec (`fviews`, …) into the decoded shape (`views`, …).
 *
 * Intentional duplicate of `decodeUiSpec` in `datamodel/core.ts` — retain only in
 * migration code so encode/decode can be removed from the rest of the codebase after
 * cutover.
 */
function decodeLegacyEncodedUiSpec(
  rawUiSpec: EncodedUISpecification
): Pick<ProjectUIModel, 'fields' | 'views' | 'viewsets' | 'visible_types'> {
  return {
    fields: rawUiSpec.fields,
    views: rawUiSpec.fviews,
    viewsets: rawUiSpec.viewsets,
    visible_types: rawUiSpec.visible_types,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a Couch `ui-specification` document body (encoded wire shape).
 * @throws if the document is not a valid encoded UI spec
 */
export function parseEncodedUiSpecDocument(
  doc: unknown
): EncodedUISpecification {
  if (!isPlainObject(doc)) {
    throw new Error('UI specification document must be a JSON object');
  }

  const {fields, fviews, viewsets, visible_types} = doc;

  if (!isPlainObject(fields)) {
    throw new Error('UI specification missing fields object');
  }
  if (!isPlainObject(fviews)) {
    throw new Error('UI specification missing fviews object');
  }
  if (!isPlainObject(viewsets)) {
    throw new Error('UI specification missing viewsets object');
  }
  if (
    !Array.isArray(visible_types) ||
    !visible_types.every(entry => typeof entry === 'string')
  ) {
    throw new Error('UI specification visible_types must be a string array');
  }

  return EncodedUISpecificationSchema.parse({
    fields,
    fviews,
    viewsets,
    visible_types,
  });
}

/**
 * Coerce legacy `showQRCodeButton` to `uiSpec.settings.showQrCodeButton`.
 * Only boolean `true` and the string `'true'` enable QR search; all other values are false.
 */
export function coerceShowQrCodeButton(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Short operational description for `Project.description` / `Template.description`.
 */
export function deriveRootDescription(
  legacyMetadata: LegacyNotebookMetadata
): string {
  const description = legacyMetadata.description;
  if (typeof description === 'string' && description.trim()) {
    return description.trim();
  }
  const preDescription = legacyMetadata.pre_description;
  if (typeof preDescription === 'string' && preDescription.trim()) {
    const trimmed = preDescription.trim();
    if (trimmed.length <= OLD_DESCRIPTION_MAX_LENGTH) {
      return trimmed;
    }
    return `${trimmed.slice(0, OLD_DESCRIPTION_MAX_LENGTH)}…`;
  }
  return '';
}

function stringOrEmpty(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function buildCustomMetadata(
  legacyMetadata: LegacyNotebookMetadata
): Record<string, unknown> | undefined {
  const custom: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(legacyMetadata)) {
    if (LEGACY_KEYS_MAPPED.has(key) || LEGACY_KEYS_DROPPED.has(key)) {
      continue;
    }
    custom[key] = value;
  }
  return Object.keys(custom).length > 0 ? custom : undefined;
}

/**
 * Read merged per-key metadata and the `ui-specification` doc from a project's
 * metadata database (same rules as API `getNotebookMetadata` + `getEncodedNotebookUISpec`).
 */
export async function readLegacyNotebookFromMetadataDb(
  metaDB: DatabaseInterface,
  _projectId: string
): Promise<{
  metadata: LegacyNotebookMetadata;
  encodedUiSpec?: EncodedUISpecification;
}> {
  const metadata: LegacyNotebookMetadata = {};
  let encodedUiSpec: EncodedUISpecification | undefined;

  const metaDocs = await metaDB.allDocs({include_docs: true});
  for (const row of metaDocs.rows) {
    const id = row.id;
    if (!id || id.startsWith('_design/')) {
      continue;
    }

    if (id === UI_SPECIFICATION_NAME && row.doc) {
      const {_id: _couchId, _rev: _couchRev, ...specBody} = row.doc;
      encodedUiSpec = parseEncodedUiSpecDocument(specBody);
      continue;
    }

    const prefix = `${PROJECT_METADATA_PREFIX}-`;
    if (id.startsWith(prefix)) {
      const key = id.substring(prefix.length);
      // Flat aggregate doc — not reliable for round-trip (see metadata-design.md).
      if (key === 'projectvalue') {
        continue;
      }
      const wrapped = row.doc as {metadata?: unknown} | undefined;
      if (wrapped && 'metadata' in wrapped) {
        metadata[key] = wrapped.metadata;
      }
    }
  }

  return {metadata, encodedUiSpec};
}

/**
 * Build {@link NotebookDefinition} from legacy template metadata + encoded UI spec,
 * running {@link migrateNotebook} on the wire notebook shape first.
 */
export function buildSurveyNotebookDefinitionFromLegacy({
  legacyMetadata,
  encodedUiSpec,
}: {
  legacyMetadata: LegacyNotebookMetadata;
  encodedUiSpec?: EncodedUISpecification;
}): NotebookDefinition {
  const notebook = {
    metadata: {...legacyMetadata},
    'ui-specification': encodedUiSpec ?? emptyEncodedUiSpec(),
  };

  const {migrated} = migrateNotebook(notebook);
  const migratedMeta = migrated.metadata ?? {};
  const migratedEncoded = EncodedUISpecificationSchema.parse(
    migrated['ui-specification'] ?? emptyEncodedUiSpec()
  );
  const decodedUiSpec = decodeLegacyEncodedUiSpec(migratedEncoded);

  const schemaVersion = stringOrEmpty(migratedMeta.schema_version) || '3.0';

  const information = {
    notebookVersion: stringOrEmpty(migratedMeta.notebook_version),
    purposeMarkdown: stringOrEmpty(migratedMeta.pre_description),
    projectLeadLabel: stringOrEmpty(migratedMeta.project_lead),
    leadInstitution: stringOrEmpty(migratedMeta.lead_institution),
    ...(migratedMeta['derived-from'] !== undefined &&
    migratedMeta['derived-from'] !== null &&
    String(migratedMeta['derived-from']).trim() !== ''
      ? {derivedFromTemplateId: stringOrEmpty(migratedMeta['derived-from'])}
      : {}),
  };

  const custom = buildCustomMetadata(migratedMeta);

  const uiSpec: NotebookUiSpec = {
    fields: decodedUiSpec.fields,
    views: decodedUiSpec.views,
    viewsets: decodedUiSpec.viewsets,
    visible_types: decodedUiSpec.visible_types,
    settings: {
      showQrCodeButton: coerceShowQrCodeButton(migratedMeta.showQRCodeButton),
    },
    schemaVersion,
  };

  const uiSpecification: NotebookDefinition = {
    uiSpec,
    metadata: {
      information,
      ...(custom !== undefined ? {custom} : {}),
    },
  };

  return uiSpecification;
}

/** ISO timestamps for migrated audit fields (both set to migration run time). */
export function migrationTimestamps(): {createdAt: string; updatedAt: string} {
  const now = new Date().toISOString();
  return {createdAt: now, updatedAt: now};
}
