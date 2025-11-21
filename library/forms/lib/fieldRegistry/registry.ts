import {FullFieldProps} from '../formModule/types';
import {fileUploaderFieldSpec} from './fields/FileUploader';
import {richTextFieldSpec} from './fields/RichText';
import {selectFieldSpec} from './fields/SelectField';
import {takePhotoFieldSpec} from './fields/TakePhoto';
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
 */
export const getFieldInfo = ({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): FieldInfo | undefined => {
  const key = buildKey({namespace, name});
  return FIELD_REGISTRY.get(key);
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
