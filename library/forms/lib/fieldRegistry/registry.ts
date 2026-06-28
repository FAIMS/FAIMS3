import {FullFieldProps} from '../formModule/types';
import {addressFieldSpec} from './fields/AddressField';
import {advancedSelectFieldSpec} from './fields/AdvancedSelect';
import {audioRecorderFieldSpec} from './fields/AudioRecorder';
import {checkboxFieldSpec} from './fields/CheckboxField';
import {computedFieldSpec} from './fields/ComputedField';
import {
  datePickerFieldSpec,
  dateTimePickerFieldSpec,
  monthPickerFieldSpec,
} from './fields/DateFields';
import {fileUploaderFieldSpec} from './fields/FileUploader';
import {mapFieldSpec} from './fields/MapField';
import {multiSelectFieldSpec} from './fields/MultiSelect';
import {numberFieldSpec} from './fields/NumberField';
import {percentageSliderFieldSpec} from './fields/PercentageSlider';
import {qrCodeFieldSpec} from './fields/QRCodeFormField';
import {radioGroupFieldSpec} from './fields/RadioGroup';
import {relatedRecordFieldSpec} from './fields/RelatedRecord';
import {richTextFieldSpec} from './fields/RichText';
import {selectFieldSpec} from './fields/SelectField';
import {takePhotoFieldSpec} from './fields/TakePhoto';
import {takePointFieldSpec} from './fields/TakePoint';
import {templatedStringFieldSpec} from './fields/TemplatedStringField';
import {emailFieldSpec, textFieldSpec} from './fields/TextFields';
import {FieldInfo} from './types';

// Canonical field specifications. Each spec is registered under its own
// `namespace::name`. To add a new field type, add it here.
const FieldSpecList: FieldInfo<FullFieldProps & any>[] = [
  textFieldSpec,
  emailFieldSpec,
  richTextFieldSpec,
  selectFieldSpec,
  takePhotoFieldSpec,
  fileUploaderFieldSpec,
  relatedRecordFieldSpec,
  templatedStringFieldSpec,
  multiSelectFieldSpec,
  advancedSelectFieldSpec,
  checkboxFieldSpec,
  radioGroupFieldSpec,
  takePointFieldSpec,
  mapFieldSpec,
  qrCodeFieldSpec,
  datePickerFieldSpec,
  dateTimePickerFieldSpec,
  monthPickerFieldSpec,
  percentageSliderFieldSpec,
  numberFieldSpec,
  computedFieldSpec,
  addressFieldSpec,
  audioRecorderFieldSpec,
];

/**
 * Legacy `component-namespace::component-name` keys that resolve to a canonical
 * spec for backward compatibility with notebooks not yet migrated to the
 * latest schema. The same spec object is shared — no duplicated definitions.
 *
 * - `faims-custom::FAIMSTextField`         → unified TextField (v4 rename)
 * - `formik-material-ui::MultipleTextField` → unified TextField (v4 merge with
 *   `multiline: true` + lifted rows). The TextField component reads the legacy
 *   `InputProps.rows` shape, so un-migrated fields still render correctly.
 *
 * Once the v4 notebook migration is confirmed-rolled-out across all live
 * notebooks, these aliases can be removed in a follow-up.
 */
const LEGACY_FIELD_ALIASES: Array<{
  namespace: string;
  name: string;
  spec: FieldInfo<FullFieldProps & any>;
}> = [
  // Text-field consolidation (v4): both legacy text names → unified TextField.
  {namespace: 'faims-custom', name: 'FAIMSTextField', spec: textFieldSpec},
  {
    namespace: 'formik-material-ui',
    name: 'MultipleTextField',
    spec: textFieldSpec,
  },
  // Number-field consolidation (v4): the legacy bounded-integer
  // `ControlledNumber` is folded into the unified `NumberField` runtime.
  // The unified spec accepts `min`/`max` at the same top-level keys
  // ControlledNumber used, so un-migrated fields render correctly via this
  // alias.
  {namespace: 'faims-custom', name: 'ControlledNumber', spec: numberFieldSpec},
  // Date-field consolidation (v4): the legacy `DateTimeNow` field (datetime-
  // local with a hardcoded "Now" button) is folded into the unified
  // `DateTimePicker` runtime, which now exposes the Now button via the
  // optional `show_now_button` parameter. The DateTimePicker component reads
  // both the canonical `isAutoPick` and the legacy `is_auto_pick` keys, so
  // un-migrated DateTimeNow data renders correctly via this alias.
  {
    namespace: 'faims-custom',
    name: 'DateTimeNow',
    spec: dateTimePickerFieldSpec,
  },
];

// Build the map from `namespace::name` to the field info, including legacy aliases.
const FIELD_REGISTRY: Map<string, FieldInfo> = new Map();
for (const spec of FieldSpecList) {
  FIELD_REGISTRY.set(
    buildKey({namespace: spec.namespace, name: spec.name}),
    spec
  );
}
for (const alias of LEGACY_FIELD_ALIASES) {
  FIELD_REGISTRY.set(
    buildKey({namespace: alias.namespace, name: alias.name}),
    alias.spec
  );
}

// Internal helper to build the registry key
function buildKey({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): string {
  return `${namespace}::${name}`;
}

// Internal helper to split the registry key
function splitKey(key: string): {
  namespace: string;
  name: string;
} {
  const parts = key.split('::');
  if (parts.length !== 2) {
    throw new Error(`Invalid key: ${key}`);
  }
  return {
    namespace: parts[0],
    name: parts[1],
  };
}

/**
 * Get field info by namespace and name
 *  if we can't find the field, fall back to a text field
 *  returns {info, fallback}
 */
export const getFieldInfo = ({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): {fieldInfo: FieldInfo<any>; fallback: boolean} => {
  const key = buildKey({namespace, name});
  const fieldInfo = FIELD_REGISTRY.get(key);
  if (fieldInfo) return {fieldInfo, fallback: false};
  else return {fieldInfo: textFieldSpec, fallback: true};
};

/**
 * Validate the registry on load. Legacy alias keys are intentionally allowed
 * to differ from their underlying spec's own `namespace::name`, so they're
 * exempted from the strict key-consistency check.
 */
const validateFieldRegistry = (registry: Map<string, FieldInfo>) => {
  const aliasKeys = new Set(
    LEGACY_FIELD_ALIASES.map(a =>
      buildKey({namespace: a.namespace, name: a.name})
    )
  );
  for (const [key, spec] of registry) {
    if (aliasKeys.has(key)) continue;
    const {namespace, name} = splitKey(key);
    if (namespace !== spec.namespace || name !== spec.name) {
      throw new Error(
        `Field registry key mismatch: key "${key}" does not match spec namespace "${spec.namespace}" and name "${spec.name}"`
      );
    }
  }
};

// Always validate the registry on load
validateFieldRegistry(FIELD_REGISTRY);

// Ignored fields - narrow exception cases which should never be rendered.
// NOTE: do NOT add deprecated fields here — they will silently disappear from
// existing notebooks. Deprecated fields should only be hidden from the chooser
// (showInChooser: false in fields.tsx). Use migrations to move existing data.
export const FORCE_IGNORED_FIELDS: Array<{name: string; namespace: string}> = [
  {
    namespace: 'faims-custom',
    name: 'BasicAutoIncrementer',
  },
];
