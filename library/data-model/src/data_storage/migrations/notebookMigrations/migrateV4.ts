/**
 * @file V4 notebook migration. Rewrites legacy field shapes to their
 * canonical names and bumps `schema_version` to '4.0'. Companion to the
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

type NotebookMetadata = {
  [key: string]: unknown;
};

type NotebookUISpec = {
  fields: {[key: string]: any};
  fviews: {[key: string]: any};
  viewsets: {[key: string]: any};
  visible_types: string[];
};

type NotebookAfterV3 = {
  metadata: NotebookMetadata;
  'ui-specification': NotebookUISpec;
};

/** Fallback when a legacy MultipleTextField had no explicit InputProps.rows. */
const DEFAULT_TEXTAREA_ROWS = 4;

/**
 * Migrate a v3 notebook to v4. Deep-clones the input; returns the new
 * notebook with `schema_version` set to `'4.0'`.
 */
export const migrateToV4 = (notebook: any): NotebookAfterV3 => {
  const out = JSON.parse(JSON.stringify(notebook)) as NotebookAfterV3;
  const fields = out['ui-specification']?.fields ?? {};

  for (const fieldName of Object.keys(fields)) {
    const field = fields[fieldName];
    if (!field || typeof field !== 'object') continue;

    migrateTextField(field);
    migrateNumberField(field);
    migrateDateField(field);
    migrateChoiceField(field);
  }

  out.metadata.schema_version = '4.0';
  return out;
};

/** MultipleTextField + FAIMSTextField → TextField. */
function migrateTextField(field: any): void {
  const cn = field['component-name'];

  if (cn === 'MultipleTextField') {
    const params = field['component-parameters'] ?? {};
    // Lift the legacy `InputProps.rows` to the top level — TextField reads
    // `rows` directly. Fall back to the runtime's render-time default.
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
    // Pure rename — same React component; existing params already describe
    // whichever mode (short / long) the field was in.
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

  // is_auto_pick → isAutoPick (don't overwrite an explicit canonical value).
  if (params.isAutoPick === undefined && params.is_auto_pick !== undefined) {
    params.isAutoPick = params.is_auto_pick;
  }
  delete params.is_auto_pick;

  // DateTimeNow always rendered the Now button — preserve that.
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

    // Only synthesise Yes/No if no options were already configured.
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
    // ElementProps shape matches RadioGroup — no parameter changes needed.
    field['component-namespace'] = 'faims-custom';
    field['component-name'] = 'RadioGroup';
    field['type-returned'] = 'faims-core::String';
    return;
  }
}
