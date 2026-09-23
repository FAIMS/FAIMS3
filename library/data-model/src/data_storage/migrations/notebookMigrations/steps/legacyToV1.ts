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

/**
 * @file `legacy → 1.0.0` — the single "get up to speed" step that collapses
 * every pre-semver notebook JSON shape into the strict-semver epoch.
 *
 * ## Why this file is deliberately dense
 *
 * The deprecated two-part ladder (`1.0 → 2.0 → … → 7.0`) used to be six
 * separate modules chained by an `if` cascade. Those versions are no longer a
 * public sequence, so all of their transforms are **inlined here as commented
 * stages** inside one function. The harness (`registry.ts`, `identify.ts`,
 * `runner.ts`) stays clean; this catch-up path is allowed to be congested.
 *
 * Stages run as a fall-through cascade on a local `version` cursor so a
 * notebook at *any* historical point (missing version, `1.0`, `4.0`, `7.0`, …)
 * ends at `1.0.0`. Unknown non-semver versions throw.
 *
 * ## Frozen contract
 *
 * This module does **not** import the live application model for its
 * intermediate shapes; it works on loose records and only uses the live V1 Zod
 * schema in {@link validateV1} to assert the *output*. Refactors to the current
 * `NotebookDefinition` must not force edits to the historical stages.
 */

import {z} from 'zod';
import {NotebookDefinitionV1Schema} from '../../../../uiSpecification/types';
import {NOTEBOOK_SCHEMA_LEGACY, NotebookSchemaMigrationError} from '../types';
import {getNotebookSchemaVersion} from '../version';

/** Output version of this step. */
export const LEGACY_TO_V1_TARGET = '1.0.0' as const;

// ============================================================================
// Legacy wire shape (pre-5.0): `{ metadata, 'ui-specification' }` with `fviews`
// ============================================================================

type LegacyMetadata = Record<string, any>;

type LegacyEncodedUiSpec = {
  fields: Record<string, any>;
  fviews: Record<string, any>;
  viewsets: Record<string, any>;
  visible_types: string[];
};

/**
 * Original notebook wire shape (schema `1.0`–`4.0`). Exported for fixtures and
 * Couch migrations that still build this shape from legacy metadata DBs.
 */
export type LegacyNotebookWire = {
  metadata: LegacyMetadata;
  'ui-specification': LegacyEncodedUiSpec;
};

/** Loose parser for the encoded wire UI spec (`fviews`, not `views`). */
const LegacyEncodedUiSpecSchema = z
  .object({
    fields: z.record(z.string(), z.any()),
    fviews: z.record(z.string(), z.any()),
    viewsets: z.record(z.string(), z.any()),
    visible_types: z.array(z.string()),
  })
  .passthrough();

// ============================================================================
// The collapse
// ============================================================================

/**
 * Collapse any pre-semver notebook JSON to schema `1.0.0`.
 *
 * @param input notebook JSON at any historical shape (not mutated)
 * @returns a new notebook at `1.0.0` (`{uiSpec, metadata}` with `views`)
 * @throws {NotebookSchemaMigrationError} on an unrecognised legacy version
 */
export function migrateLegacyToV1(input: unknown): unknown {
  // Deep clone so no stage mutates the caller's object.
  const nb: any = JSON.parse(JSON.stringify(input ?? {}));
  nb.metadata ??= {};

  let version: string | null | undefined = getNotebookSchemaVersion(nb);

  // --------------------------------------------------------------------------
  // was v2: normalise the original (schema 1.0 / unversioned) ui-specification.
  // This stage had to cope with many pre-versioning inconsistencies, so it is
  // the longest. Input: legacy wire. Output: legacy wire, schema_version '2.0'.
  // --------------------------------------------------------------------------
  if (version === undefined || version === null || version === '1.0') {
    if (!nb['ui-specification'] || typeof nb['ui-specification'] !== 'object') {
      throw new NotebookSchemaMigrationError(
        'Legacy notebook is missing a ui-specification object',
        {from: NOTEBOOK_SCHEMA_LEGACY, to: LEGACY_TO_V1_TARGET}
      );
    }
    v2_removeNullFieldConditions(nb);
    v2_removeNullFviewConditions(nb);
    v2_updateFieldLabels(nb);
    v2_updateAnnotationFormat(nb);
    v2_updateHelperText(nb);
    v2_updateFormSectionMeta(nb);
    // (photo validation fix dropped — validation arrays are no longer used)
    v2_requireTemplatedStringFields(nb);
    v2_fixAutoIncrementerInitialValue(nb);
    v2_fixOldHridPrefix(nb);
    v2_updateVisibleTypes(nb);
    v2_migrateEmailFields(nb);
    // must run before removeValidationSchema (reads yup.min/max)
    v2_migrateNumberFields(nb);
    v2_migrateTextFields(nb);
    v2_removeValidationSchema(nb);
    v2_migrateRandomStyleFields(nb);
    nb.metadata.schema_version = '2.0';
    version = '2.0';
  }

  // --------------------------------------------------------------------------
  // was v3: drop `metadata.project_status` (archive state moved to the template
  // document). Output: schema_version '3.0'.
  // --------------------------------------------------------------------------
  if (version === '2.0') {
    if ('project_status' in nb.metadata) {
      delete nb.metadata.project_status;
    }
    nb.metadata.schema_version = '3.0';
    version = '3.0';
  }

  // --------------------------------------------------------------------------
  // was v4: rewrite legacy field component names to canonical registry names
  // (MultipleTextField/FAIMSTextField → TextField, ControlledNumber →
  // NumberField, DateTimeNow → DateTimePicker, Checkbox/Select → RadioGroup).
  // Output: schema_version '4.0'.
  // --------------------------------------------------------------------------
  if (version === '3.0') {
    const fields = nb['ui-specification']?.fields ?? {};
    for (const fieldName of Object.keys(fields)) {
      const field = fields[fieldName];
      if (!field || typeof field !== 'object') continue;
      v4_migrateTextField(field);
      v4_migrateNumberField(field);
      v4_migrateDateField(field);
      v4_migrateChoiceField(field);
    }
    nb.metadata.schema_version = '4.0';
    version = '4.0';
  }

  // --------------------------------------------------------------------------
  // was v5: restructure wire `{metadata, 'ui-specification'}` into
  // `{uiSpec, metadata}` — decode `fviews → views`, split loose metadata into
  // typed `information` / `settings` / `custom`. Output: uiSpec.schemaVersion '5.0'.
  // --------------------------------------------------------------------------
  let current: any = nb;
  if (version === '4.0') {
    const legacyMetadata: LegacyMetadata = nb.metadata ?? {};
    const encoded = LegacyEncodedUiSpecSchema.parse(
      nb['ui-specification'] ?? {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: [],
      }
    );

    const derivedFrom = legacyMetadata['derived-from'];
    const information: Record<string, unknown> = {
      notebookVersion: v5_stringOrEmpty(legacyMetadata.notebook_version),
      purposeMarkdown: v5_stringOrEmpty(legacyMetadata.pre_description),
      projectLeadLabel: v5_stringOrEmpty(legacyMetadata.project_lead),
      leadInstitution: v5_stringOrEmpty(legacyMetadata.lead_institution),
      ...(derivedFrom !== undefined &&
      derivedFrom !== null &&
      String(derivedFrom).trim() !== ''
        ? {derivedFromTemplateId: v5_stringOrEmpty(derivedFrom)}
        : {}),
    };

    const custom = v5_buildCustomMetadata(legacyMetadata);

    current = {
      uiSpec: {
        fields: encoded.fields,
        views: encoded.fviews,
        viewsets: encoded.viewsets,
        visible_types: encoded.visible_types,
        settings: {
          showQrCodeButton:
            legacyMetadata.showQRCodeButton === true ||
            legacyMetadata.showQRCodeButton === 'true',
        },
        schemaVersion: '5.0',
      },
      metadata: {
        information,
        ...(custom !== undefined ? {custom} : {}),
      },
    };
    version = '5.0';
  }

  // --------------------------------------------------------------------------
  // was v6: rename `ComputedField` → `ComputedNumber` (#2197). Output '6.0'.
  // --------------------------------------------------------------------------
  if (version === '5.0') {
    for (const fieldDef of Object.values(current.uiSpec?.fields ?? {})) {
      if (
        fieldDef &&
        typeof fieldDef === 'object' &&
        (fieldDef as any)['component-name'] === 'ComputedField'
      ) {
        (fieldDef as any)['component-name'] = 'ComputedNumber';
      }
    }
    current.uiSpec.schemaVersion = '6.0';
    version = '6.0';
  }

  // --------------------------------------------------------------------------
  // was v7: strip the dead `displayParent` field property (#31). Output '7.0'.
  // --------------------------------------------------------------------------
  if (version === '6.0') {
    for (const fieldDef of Object.values(current.uiSpec?.fields ?? {})) {
      if (fieldDef && typeof fieldDef === 'object') {
        delete (fieldDef as any).displayParent;
      }
    }
    current.uiSpec.schemaVersion = '7.0';
    version = '7.0';
  }

  // --------------------------------------------------------------------------
  // epoch: stamp strict semver. `7.0` was the last deprecated two-part value;
  // nothing structural changed between it and `1.0.0`.
  // --------------------------------------------------------------------------
  if (version === '7.0') {
    if (!current.uiSpec || typeof current.uiSpec !== 'object') {
      throw new NotebookSchemaMigrationError(
        'Legacy notebook at 7.0 is missing a uiSpec object',
        {from: NOTEBOOK_SCHEMA_LEGACY, to: LEGACY_TO_V1_TARGET}
      );
    }
    current.uiSpec.schemaVersion = LEGACY_TO_V1_TARGET;
    // A stray legacy key on a 5.0+ document must not shadow uiSpec.schemaVersion.
    if (current.metadata && 'schema_version' in current.metadata) {
      delete current.metadata.schema_version;
    }
    return current;
  }

  throw new NotebookSchemaMigrationError(
    `Unrecognised legacy notebook schema version '${String(version)}'`,
    {from: NOTEBOOK_SCHEMA_LEGACY, to: LEGACY_TO_V1_TARGET}
  );
}

/**
 * Validate the output of {@link migrateLegacyToV1} against the live V1 schema
 * and confirm the version stamp.
 */
export function validateV1(output: unknown): void {
  const parsed = NotebookDefinitionV1Schema.parse(output);
  if (parsed.uiSpec.schemaVersion !== LEGACY_TO_V1_TARGET) {
    throw new Error(
      `expected schemaVersion ${LEGACY_TO_V1_TARGET}, got ${parsed.uiSpec.schemaVersion}`
    );
  }
}

// ============================================================================
// was v2 — helpers (operate on the legacy wire shape in place)
// ============================================================================

function v2_removeNullFviewConditions(nb: any) {
  const fviews = nb['ui-specification']?.fviews;
  if (!fviews) return;
  for (const viewId of Object.keys(fviews)) {
    const view = fviews[viewId];
    if (view && 'condition' in view && view.condition === null) {
      delete view.condition;
    }
  }
}

function v2_removeNullFieldConditions(nb: any) {
  const fields = nb['ui-specification']?.fields;
  if (!fields) return;
  const cleaned: Record<string, any> = {};
  for (const [fieldName, field] of Object.entries<any>(fields)) {
    if (field === null) continue;
    if (field.condition === null) delete field.condition;
    cleaned[fieldName] = field;
  }
  nb['ui-specification'].fields = cleaned;
}

/** TemplatedStringField must be required so it is eligible as an HRID field. */
function v2_requireTemplatedStringFields(nb: any) {
  for (const field of Object.values<any>(nb['ui-specification'].fields)) {
    if (field['component-name'] === 'TemplatedStringField') {
      field['component-parameters'].required = true;
    }
  }
}

/** Collapse the many historical label locations onto `component-parameters.label`. */
function v2_updateFieldLabels(nb: any) {
  const fields: Record<string, any> = {};
  for (const fieldName in nb['ui-specification'].fields) {
    const field = nb['ui-specification'].fields[fieldName];
    const params = field['component-parameters'];
    if (params?.label) {
      fields[fieldName] = {...field};
      continue;
    } else if (params?.InputLabelProps?.label) {
      params.label = params.InputLabelProps.label;
      delete params.InputLabelProps;
    } else if (params?.FormControlLabelProps?.label) {
      params.label = params.FormControlLabelProps.label;
      delete params.FormControlLabelProps;
    } else if (params?.FormLabelProps?.children) {
      params.label = params.FormLabelProps.children;
      delete params.FormLabelProps;
    } else if (params?.name) {
      params.label = params.name;
    }
    fields[fieldName] = {...field, 'component-parameters': params};
  }
  nb['ui-specification'].fields = fields;
}

/** `meta.annotation: boolean` + `annotation_label` → `{include, label}` objects. */
function v2_updateAnnotationFormat(nb: any) {
  for (const field of Object.values<any>(nb['ui-specification'].fields)) {
    const meta = field.meta;
    if (typeof meta?.annotation === 'boolean') {
      field.meta = {
        annotation: {
          include: meta.annotation,
          label: meta.annotation_label || 'Annotation',
        },
        uncertainty: {
          include: meta.uncertainty?.include || false,
          label: meta.uncertainty?.label || 'uncertainty',
        },
      };
    }
  }
}

/** `helpertext` (TakePhoto) / `FormHelperTextProps.children` → `helperText`. */
function v2_updateHelperText(nb: any) {
  for (const field of Object.values<any>(nb['ui-specification'].fields)) {
    const params = field['component-parameters'];
    const originalValue = params?.helperText;
    if (params?.helpertext) {
      params.helperText = originalValue || params.helpertext;
      delete params.helpertext;
    } else if (params?.FormHelperTextProps) {
      params.helperText = originalValue || params.FormHelperTextProps.children;
      delete params.FormHelperTextProps;
    }
  }
}

/** Move `metadata.sections[id]['sectiondescription'+id]` onto `fviews[id].description`. */
function v2_updateFormSectionMeta(nb: any) {
  const sections = nb.metadata?.sections;
  const fviews = nb['ui-specification'].fviews;
  const prefix = 'sectiondescription';
  if (sections) {
    for (const sectionId in sections) {
      const description = sections[sectionId][prefix + sectionId] || '';
      if (fviews[sectionId]) {
        fviews[sectionId].description = description;
      }
    }
    delete nb.metadata.sections;
  }
}

/** Old BasicAutoIncrementer had `initialValue: null`, which broke validation. */
function v2_fixAutoIncrementerInitialValue(nb: any) {
  for (const field of Object.values<any>(nb['ui-specification'].fields)) {
    if (
      field['component-name'] === 'BasicAutoIncrementer' &&
      field.initialValue === null
    ) {
      field.initialValue = '';
    }
  }
}

/** Fields named `hrid*` become the viewset's `hridField`; drop the old `hrid` param. */
function v2_fixOldHridPrefix(nb: any) {
  const spec = nb['ui-specification'];
  const fieldToViewset: Record<string, string> = {};
  for (const viewsetId of Object.keys(spec.viewsets)) {
    const viewset = spec.viewsets[viewsetId];
    for (const viewId of viewset.views ?? []) {
      const view = spec.fviews[viewId];
      for (const fieldName of view?.fields ?? []) {
        fieldToViewset[fieldName] = viewsetId;
      }
    }
  }
  for (const fieldName of Object.keys(spec.fields)) {
    const params = spec.fields[fieldName]['component-parameters'];
    if (params && 'hrid' in params) {
      delete params.hrid;
    }
    if (fieldName.startsWith('hrid')) {
      const viewsetName = fieldToViewset[fieldName];
      if (viewsetName) {
        spec.viewsets[viewsetName].hridField = fieldName;
      }
    }
  }
}

/** Ensure `visible_types` exists (defaults to every viewset id). */
function v2_updateVisibleTypes(nb: any) {
  if (!nb['ui-specification'].visible_types) {
    nb['ui-specification'].visible_types =
      Object.keys(nb['ui-specification'].viewsets) || [];
  }
}

/** Yup validation arrays are no longer used. */
function v2_removeValidationSchema(nb: any) {
  for (const field of Object.values<any>(nb['ui-specification'].fields ?? {})) {
    if ('validationSchema' in field) {
      delete field.validationSchema;
    }
  }
}

/** Any remaining `formik-material-ui::TextField` → `faims-custom::FAIMSTextField`. */
function v2_migrateTextFields(nb: any) {
  const fields = nb['ui-specification']?.fields;
  if (!fields) return;
  for (const fieldName in fields) {
    const field = fields[fieldName];
    if (
      field['component-namespace'] === 'formik-material-ui' &&
      field['component-name'] === 'TextField'
    ) {
      const p = field['component-parameters'];
      field['component-namespace'] = 'faims-custom';
      field['component-name'] = 'FAIMSTextField';
      field['component-parameters'] = {
        label: p.label,
        name: fieldName,
        helperText: p.helperText,
        required: p.required || false,
      };
    }
  }
}

/** `formik-material-ui::TextField` returning `faims-core::Email` → `faims-custom::Email`. */
function v2_migrateEmailFields(nb: any) {
  for (const field of Object.values<any>(
    nb['ui-specification']?.fields ?? {}
  )) {
    if (
      field['component-namespace'] === 'formik-material-ui' &&
      field['component-name'] === 'TextField' &&
      field['type-returned'] === 'faims-core::Email'
    ) {
      field['component-namespace'] = 'faims-custom';
      field['component-name'] = 'Email';
      field['type-returned'] = 'faims-core::String';
      if (field['component-parameters']?.InputProps) {
        delete field['component-parameters'].InputProps;
      }
    }
  }
}

/**
 * `formik-material-ui::TextField` with `InputProps.type === 'number'` →
 * `ControlledNumber` (when yup.min/max present) or `NumberField` (integer).
 * Must run before {@link v2_removeValidationSchema}.
 */
function v2_migrateNumberFields(nb: any) {
  for (const field of Object.values<any>(
    nb['ui-specification']?.fields ?? {}
  )) {
    if (
      field['component-namespace'] === 'formik-material-ui' &&
      field['component-name'] === 'TextField' &&
      field['component-parameters']?.InputProps?.type === 'number'
    ) {
      let min: number | undefined;
      let max: number | undefined;
      if (Array.isArray(field.validationSchema)) {
        for (const rule of field.validationSchema as unknown[][]) {
          if (Array.isArray(rule) && rule[0] === 'yup.min')
            min = rule[1] as number;
          if (Array.isArray(rule) && rule[0] === 'yup.max')
            max = rule[1] as number;
        }
      }
      if (field['component-parameters']?.InputProps) {
        delete field['component-parameters'].InputProps;
      }
      if (min !== undefined || max !== undefined) {
        field['component-namespace'] = 'faims-custom';
        field['component-name'] = 'ControlledNumber';
        if (min !== undefined) field['component-parameters'].min = min;
        if (max !== undefined) field['component-parameters'].max = max;
      } else {
        field['component-namespace'] = 'faims-custom';
        field['component-name'] = 'NumberField';
        field['type-returned'] = 'faims-core::Number';
        field['component-parameters'].numberType = 'integer';
      }
    }
  }
}

/** `faims-custom::RandomStyle` → `RichText` with markdown built from label/variant/html_tag. */
function v2_migrateRandomStyleFields(nb: any) {
  const fields = nb['ui-specification']?.fields;
  if (!fields) return;
  for (const fieldName in fields) {
    const field = fields[fieldName];
    if (
      field['component-namespace'] === 'faims-custom' &&
      field['component-name'] === 'RandomStyle'
    ) {
      const params = field['component-parameters'] ?? {};
      const label: string = params.label || '';
      const variantStyle: string = params.variant_style || '';
      const htmlTag: string = params.html_tag || '';
      let content = '';
      if (label) {
        switch (variantStyle) {
          case 'h1':
            content = `# ${label}`;
            break;
          case 'h2':
            content = `## ${label}`;
            break;
          case 'h3':
            content = `### ${label}`;
            break;
          case 'h4':
            content = `#### ${label}`;
            break;
          case 'h5':
            content = `##### ${label}`;
            break;
          case 'subtitle1':
          case 'subtitle2':
            content = `**${label}**`;
            break;
          default:
            content = label;
        }
      }
      if (htmlTag) {
        if (content) content += '\n\n';
        content += htmlTag;
      }
      field['component-name'] = 'RichText';
      field['component-parameters'] = {
        label: params.label ?? fieldName,
        name: fieldName,
        content: content || '',
      };
    }
  }
}

// ============================================================================
// was v4 — helpers (operate on one field in place)
// ============================================================================

const V4_DEFAULT_TEXTAREA_ROWS = 4;

/** MultipleTextField + FAIMSTextField → TextField. */
function v4_migrateTextField(field: any): void {
  const cn = field['component-name'];
  if (cn === 'MultipleTextField') {
    const params = field['component-parameters'] ?? {};
    const rows = params.InputProps?.rows ?? V4_DEFAULT_TEXTAREA_ROWS;
    delete params.InputProps;
    params.multiline = true;
    params.rows = rows;
    field['component-namespace'] = 'faims-custom';
    field['component-name'] = 'TextField';
    field['component-parameters'] = params;
    return;
  }
  if (cn === 'FAIMSTextField') {
    field['component-namespace'] = 'faims-custom';
    field['component-name'] = 'TextField';
  }
}

/** ControlledNumber → NumberField (integer; min/max preserved; type-returned → Number). */
function v4_migrateNumberField(field: any): void {
  if (field['component-name'] !== 'ControlledNumber') return;
  const params = field['component-parameters'] ?? {};
  if (params.numberType === undefined) params.numberType = 'integer';
  field['component-namespace'] = 'faims-custom';
  field['component-name'] = 'NumberField';
  field['type-returned'] = 'faims-core::Number';
  field['component-parameters'] = params;
}

/** DateTimeNow → DateTimePicker (show_now_button; is_auto_pick → isAutoPick). */
function v4_migrateDateField(field: any): void {
  if (field['component-name'] !== 'DateTimeNow') return;
  const params = field['component-parameters'] ?? {};
  if (params.isAutoPick === undefined && params.is_auto_pick !== undefined) {
    params.isAutoPick = params.is_auto_pick;
  }
  delete params.is_auto_pick;
  if (params.show_now_button === undefined) params.show_now_button = true;
  field['component-namespace'] = 'faims-custom';
  field['component-name'] = 'DateTimePicker';
  field['component-parameters'] = params;
}

/** Checkbox (synth Yes/No; bool → string) + Select → RadioGroup. */
function v4_migrateChoiceField(field: any): void {
  const cn = field['component-name'];
  if (cn === 'Checkbox') {
    const params = field['component-parameters'] ?? {};
    const existing = params.ElementProps?.options;
    if (!Array.isArray(existing) || existing.length === 0) {
      params.ElementProps = {
        ...(params.ElementProps ?? {}),
        enableOtherOption: params.ElementProps?.enableOtherOption ?? false,
        options: [
          {value: 'true', label: 'Yes'},
          {value: 'false', label: 'No'},
        ],
      };
    }
    field.initialValue = field.initialValue === true ? 'true' : '';
    field['component-namespace'] = 'faims-custom';
    field['component-name'] = 'RadioGroup';
    field['type-returned'] = 'faims-core::String';
    field['component-parameters'] = params;
    return;
  }
  if (cn === 'Select') {
    field['component-namespace'] = 'faims-custom';
    field['component-name'] = 'RadioGroup';
    field['type-returned'] = 'faims-core::String';
  }
}

// ============================================================================
// was v5 — helpers (metadata partitioning)
// ============================================================================

/** Legacy keys mapped into structured metadata — not copied to `custom`. */
const V5_KEYS_MAPPED = new Set([
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
const V5_KEYS_DROPPED = new Set([
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

function v5_stringOrEmpty(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function v5_buildCustomMetadata(
  legacyMetadata: LegacyMetadata
): Record<string, unknown> | undefined {
  const custom: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(legacyMetadata)) {
    if (V5_KEYS_MAPPED.has(key) || V5_KEYS_DROPPED.has(key)) continue;
    custom[key] = value;
  }
  return Object.keys(custom).length > 0 ? custom : undefined;
}
