import {
  PROJECT_METADATA_PREFIX,
  UI_SPECIFICATION_NAME,
} from '../../datamodel/database';
import {DatabaseInterface} from '../../types';
import type {NotebookDefinition} from '../../uiSpecification/types';
import {
  LegacyEncodedUISpecification,
  LegacyEncodedUISpecificationSchema,
} from '../templatesDB/types';
import {migrateNotebook} from './notebookMigrations';

/** Loose metadata bag as stored on templates or merged from the metadata DB. */
export type LegacyNotebookMetadata = Record<string, unknown>;

/** Max length for legacy `description` → root `description` on migrated projects/templates. */
export const OLD_DESCRIPTION_MAX_LENGTH = 250;

export function emptyEncodedUiSpec(): LegacyEncodedUISpecification {
  return {fields: {}, fviews: {}, viewsets: {}, visible_types: []};
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
): LegacyEncodedUISpecification {
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

  return LegacyEncodedUISpecificationSchema.parse({
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
function capLegacyDescription(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= OLD_DESCRIPTION_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, OLD_DESCRIPTION_MAX_LENGTH)}…`;
}

/**
 * Short operational description for `Project.description` / `Template.description`.
 * Legacy `description` is capped; `pre_description` is only used as a short fallback
 * (full text lives in `purposeMarkdown` via {@link migrateNotebook}).
 */
export function deriveRootDescription(
  legacyMetadata: LegacyNotebookMetadata
): string {
  const description = legacyMetadata.description;
  if (typeof description === 'string' && description.trim()) {
    return capLegacyDescription(description);
  }
  const preDescription = legacyMetadata.pre_description;
  if (typeof preDescription === 'string' && preDescription.trim()) {
    return preDescription.trim();
  }
  return '';
}

/**
 * Read merged per-key metadata and the `ui-specification` doc from a project's
 * metadata database (per-key `project-metadata-*` docs + `ui-specification` doc).
 */
export async function readLegacyNotebookFromMetadataDb(
  metaDB: DatabaseInterface,
  _projectId: string
): Promise<{
  metadata: LegacyNotebookMetadata;
  encodedUiSpec?: LegacyEncodedUISpecification;
}> {
  const metadata: LegacyNotebookMetadata = {};
  let encodedUiSpec: LegacyEncodedUISpecification | undefined;

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
      // Flat aggregate doc — not reliable for round-trip (see NotebookDefinition.md).
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
 * running {@link migrateNotebook} on the notebook shape first.
 */
export function buildSurveyNotebookDefinitionFromLegacy({
  legacyMetadata,
  encodedUiSpec,
}: {
  legacyMetadata: LegacyNotebookMetadata;
  encodedUiSpec?: LegacyEncodedUISpecification;
}): NotebookDefinition {
  const notebook = {
    metadata: {...legacyMetadata},
    'ui-specification': encodedUiSpec ?? emptyEncodedUiSpec(),
  };

  const {migrated} = migrateNotebook(notebook);
  return migrated;
}

/** ISO timestamps for migrated audit fields (both set to migration run time). */
export function migrationTimestamps(): {createdAt: string; updatedAt: string} {
  const now = new Date().toISOString();
  return {createdAt: now, updatedAt: now};
}
