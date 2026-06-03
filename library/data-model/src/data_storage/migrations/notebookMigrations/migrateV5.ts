// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  LegacyEncodedUISpecification,
  LegacyEncodedUISpecificationSchema,
} from '../../templatesDB/types';
import {NotebookDefinitionV4} from './migrateV4';

/**
 * @file Notebook migration to schema 5.0 — restructures wire `{ metadata, 'ui-specification' }`
 * into `{ uiSpec, metadata }` with typed `information` / `settings` / `custom` partitions.
 *
 * ## Design: self-contained migration (duplicated types and helpers)
 *
 * This module intentionally does **not** import application types such as
 * `NotebookDefinition` from `uiSpecification/types`, and it does not call shared
 * builders in `uiSpecificationMigration.ts`. Instead it duplicates the minimal
 * output interfaces (`NotebookDefinitionV5`, …) and the small helpers needed to
 * produce that shape (`decodeLegacyEncodedUiSpec`, legacy key sets, coercion, etc.).
 *
 * Rationale:
 * - **Frozen contract** — a migration is a historical transform; its input/output
 *   shape at ship time must stay stable even when the live `NotebookDefinition`
 *   schema evolves for new features.
 * - **No coupling to the app model** — refactors to zod schemas or field renames
 *   on `NotebookDefinition` must not force edits here or risk silent behaviour drift.
 * - **No circular imports** — `uiSpecificationMigration` already depends on
 *   `migrateNotebook`; pulling v5 logic back into that module would create a cycle.
 *
 * Callers that need the current application type (e.g. `buildSurveyNotebookDefinitionFromLegacy`)
 * cast the result at the boundary in `index.ts`. The duplicated types should mirror
 * the 5.0 layout in `NotebookDefinition.md` but remain owned by this file.
 */

/** UI behaviour toggles (schema 5.0). */
export type NotebookSettingsV5 = {
  showQrCodeButton: boolean;
};

/** Non-functional design documentation (schema 5.0). */
export type NotebookInformationV5 = {
  notebookVersion: string;
  purposeMarkdown: string;
  projectLeadLabel: string;
  leadInstitution: string;
  derivedFromTemplateId?: string;
};

/** Design metadata partition (schema 5.0). */
export type NotebookMetadataV5 = {
  information: NotebookInformationV5;
  custom?: Record<string, unknown>;
};

/** Decoded UI body + settings + schema version (schema 5.0). */
export type NotebookUiSpecV5 = {
  fields: Record<string, unknown>;
  views: Record<string, unknown>;
  viewsets: Record<string, unknown>;
  visible_types: string[];
  settings: NotebookSettingsV5;
  schemaVersion: string;
};

/** Notebook shape produced by this migration (schema 5.0). */
export type NotebookDefinitionV5 = {
  uiSpec: NotebookUiSpecV5;
  metadata: NotebookMetadataV5;
};

type LegacyNotebookMetadata = Record<string, unknown>;

/** Keys mapped into structured metadata — not copied to `custom`. */
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

/** Legacy keys dropped entirely (not promoted to `metadata.custom`). */
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

function emptyEncodedUiSpec(): LegacyEncodedUISpecification {
  return {fields: {}, fviews: {}, viewsets: {}, visible_types: []};
}

function decodeLegacyEncodedUiSpec(rawUiSpec: LegacyEncodedUISpecification): {
  fields: Record<string, unknown>;
  views: Record<string, unknown>;
  viewsets: Record<string, unknown>;
  visible_types: string[];
} {
  return {
    fields: rawUiSpec.fields,
    views: rawUiSpec.fviews,
    viewsets: rawUiSpec.viewsets,
    visible_types: rawUiSpec.visible_types,
  };
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

/** Coerce legacy `showQRCodeButton` to boolean (only `true` and `'true'` enable QR). */
function coerceShowQrCodeButton(value: unknown): boolean {
  return value === true || value === 'true';
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
 * Migrate a notebook from schema 4.0 to 5.0.
 *
 * @param notebook - v4 wire notebook (`metadata` + `ui-specification` with `fviews`)
 * @returns notebook with decoded `views`, typed metadata, and `uiSpec.schemaVersion` `'5.0'`
 */
export const migrateToV5 = (
  notebook: NotebookDefinitionV4
): NotebookDefinitionV5 => {
  const notebookCopy = JSON.parse(
    JSON.stringify(notebook)
  ) as NotebookDefinitionV4;

  const legacyMetadata = notebookCopy.metadata ?? {};
  const migratedEncoded = LegacyEncodedUISpecificationSchema.parse(
    notebookCopy['ui-specification'] ?? emptyEncodedUiSpec()
  );
  const decodedUiSpec = decodeLegacyEncodedUiSpec(migratedEncoded);

  const information: NotebookInformationV5 = {
    notebookVersion: stringOrEmpty(legacyMetadata.notebook_version),
    purposeMarkdown: stringOrEmpty(legacyMetadata.pre_description),
    projectLeadLabel: stringOrEmpty(legacyMetadata.project_lead),
    leadInstitution: stringOrEmpty(legacyMetadata.lead_institution),
    ...(legacyMetadata['derived-from'] !== undefined &&
    legacyMetadata['derived-from'] !== null &&
    String(legacyMetadata['derived-from']).trim() !== ''
      ? {derivedFromTemplateId: stringOrEmpty(legacyMetadata['derived-from'])}
      : {}),
  };

  const custom = buildCustomMetadata(legacyMetadata);

  const uiSpec: NotebookUiSpecV5 = {
    fields: decodedUiSpec.fields,
    views: decodedUiSpec.views,
    viewsets: decodedUiSpec.viewsets,
    visible_types: decodedUiSpec.visible_types,
    settings: {
      showQrCodeButton: coerceShowQrCodeButton(legacyMetadata.showQRCodeButton),
    },
    schemaVersion: '5.0',
  };

  return {
    uiSpec,
    metadata: {
      information,
      ...(custom !== undefined ? {custom} : {}),
    },
  };
};
