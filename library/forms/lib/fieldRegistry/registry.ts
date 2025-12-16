import {FullFieldProps} from '../formModule/types';
import {advancedSelectFieldSpec} from './fields/AdvancedSelect';
import {checkboxFieldSpec} from './fields/CheckboxField';
import {
  datePickerFieldSpec,
  dateTimePickerFieldSpec,
  monthPickerFieldSpec,
} from './fields/DateFields';
import {fileUploaderFieldSpec} from './fields/FileUploader';
import {multiSelectFieldSpec} from './fields/MultiSelect';
import {qrCodeFieldSpec} from './fields/QRCodeFormField';
import {radioGroupFieldSpec} from './fields/RadioGroup';
import {relatedRecordFieldSpec} from './fields/RelatedRecord';
import {richTextFieldSpec} from './fields/RichText';
import {selectFieldSpec} from './fields/SelectField';
import {takePhotoFieldSpec} from './fields/TakePhoto';
import {takePointFieldSpec} from './fields/TakePoint';
import {templatedStringFieldSpec} from './fields/TemplatedStringField';
import {textFieldSpec} from './fields/TextField';
import {FieldInfo} from './types';

// NOTE: This is the list of all field specifications. To add a new
// field type, add it here.
const FieldSpecList: FieldInfo<FullFieldProps & any>[] = [
  textFieldSpec,
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
  qrCodeFieldSpec,
  datePickerFieldSpec,
  dateTimePickerFieldSpec,
  monthPickerFieldSpec,
];

// Build the map from namespace::name to the field info
const FIELD_REGISTRY: Map<string, FieldInfo> = new Map();
for (const spec of FieldSpecList) {
  const key = buildKey({
    namespace: spec.namespace,
    name: spec.name,
  });
  FIELD_REGISTRY.set(key, spec);
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
}): {fieldInfo: FieldInfo; fallback: boolean} => {
  const key = buildKey({namespace, name});
  const fieldInfo = FIELD_REGISTRY.get(key);
  if (fieldInfo) return {fieldInfo, fallback: false};
  else return {fieldInfo: textFieldSpec, fallback: true};
};

// Validate the registry on load
const validateFieldRegistry = (registry: Map<string, FieldInfo>) => {
  for (const [key, spec] of registry) {
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

// Ignored fields - currently narrow exception cases which should never be rendered - e.g. incrementer
export const FORCE_IGNORED_FIELDS: Array<{name: string; namespace: string}> = [
  {
    namespace: 'faims-custom',
    name: 'BasicAutoIncrementer',
  },
];
