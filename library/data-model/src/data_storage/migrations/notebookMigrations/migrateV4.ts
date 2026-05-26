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

import {NotebookDefinitionV3} from './migrateV3';

/**
 * @file Notebook migration to schema 4.0 — rewrites legacy field shapes to their
 * canonical names and bumps `schema_version` to `'4.0'`. Companion to the
 * registry aliases in `library/forms/lib/fieldRegistry/registry.ts`.
 *
 * Migrations applied:
 *   - MultipleTextField  → TextField     (multiline:true; rows lifted from InputProps)
 *   - FAIMSTextField     → TextField     (rename only)
 *   - ControlledNumber   → NumberField   (numberType:'integer'; type-returned bumped)
 *   - DateTimeNow        → DateTimePicker (show_now_button:true; is_auto_pick → isAutoPick)
 *   - Checkbox           → RadioGroup    (synth Yes/No options; bool → string)
 *   - Select             → RadioGroup    (rename only)
 *
 * Idempotent and pure (input is not mutated). `DatePicker`, `MonthPicker`,
 * `MultiSelect`, and every non-legacy field pass through untouched.
 */

export type NotebookDefinitionV4 = NotebookDefinitionV3;

/** Fallback when a legacy MultipleTextField had no explicit InputProps.rows. */
const DEFAULT_TEXTAREA_ROWS = 4;

/**
 * Migrate a notebook from schema 3.0 to 4.0.
 *
 * @param notebook - v3 wire notebook (`metadata` + `ui-specification`)
 * @returns deep-cloned notebook with canonical field names and `schema_version` `'4.0'`
 */
export const migrateToV4 = (
  notebook: NotebookDefinitionV3
): NotebookDefinitionV4 => {
  const notebookCopy = JSON.parse(
    JSON.stringify(notebook)
  ) as NotebookDefinitionV4;

  const fields = notebookCopy['ui-specification']?.fields ?? {};

  for (const fieldName of Object.keys(fields)) {
    const field = fields[fieldName];
    if (!field || typeof field !== 'object') continue;

    migrateTextField(field);
    migrateNumberField(field);
    migrateDateField(field);
    migrateChoiceField(field);
  }

  notebookCopy.metadata.schema_version = '4.0';

  return notebookCopy;
};

/** MultipleTextField + FAIMSTextField → TextField. */
function migrateTextField(field: any): void {
  const cn = field['component-name'];

  if (cn === 'MultipleTextField') {
    const params = field['component-parameters'] ?? {};
    const rows = params.InputProps?.rows ?? DEFAULT_TEXTAREA_ROWS;
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
    return;
  }
}

/**
 * ControlledNumber → NumberField. Defaults `numberType: 'integer'` (the only
 * mode the legacy field supported); preserves `min`/`max`; bumps
 * `type-returned` from `faims-core::Integer` to `::Number`.
 */
function migrateNumberField(field: any): void {
  if (field['component-name'] !== 'ControlledNumber') return;

  const params = field['component-parameters'] ?? {};
  if (params.numberType === undefined) {
    params.numberType = 'integer';
  }

  field['component-namespace'] = 'faims-custom';
  field['component-name'] = 'NumberField';
  field['type-returned'] = 'faims-core::Number';
  field['component-parameters'] = params;
}

/**
 * DateTimeNow → DateTimePicker with `show_now_button: true`. Also renames
 * the legacy snake_case `is_auto_pick` parameter to camelCase `isAutoPick`.
 */
function migrateDateField(field: any): void {
  if (field['component-name'] !== 'DateTimeNow') return;

  const params = field['component-parameters'] ?? {};

  if (params.isAutoPick === undefined && params.is_auto_pick !== undefined) {
    params.isAutoPick = params.is_auto_pick;
  }
  delete params.is_auto_pick;

  if (params.show_now_button === undefined) {
    params.show_now_button = true;
  }

  field['component-namespace'] = 'faims-custom';
  field['component-name'] = 'DateTimePicker';
  field['component-parameters'] = params;
}

/**
 * Checkbox + Select → RadioGroup ("Select single").
 *   - Checkbox: synthesises Yes/No options; converts boolean initialValue
 *     to a string (`true` → 'true', anything else → ''); bumps
 *     `type-returned` to `::String`.
 *   - Select: pure component-name swap; ElementProps preserved.
 */
function migrateChoiceField(field: any): void {
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
    return;
  }
}
