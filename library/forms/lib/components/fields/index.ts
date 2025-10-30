import {textFieldSpec} from '../fields/TextField';
import {richTextFieldSpec} from '../fields/RichText';
import {FieldInfo} from '../../types';

export const registeredFieldTypes: {[key: string]: FieldInfo} = {
  FAIMSTextField: textFieldSpec,
  RichText: richTextFieldSpec,
};

const registerField = (fieldSpec: FieldInfo) => {
  const key = `${fieldSpec.namespace}::${fieldSpec.name}`;
  registeredFieldTypes[key] = fieldSpec;
};

export const getFieldInfo = ({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): FieldInfo | null => {
  const key = `${namespace}::${name}`;
  return registeredFieldTypes[key] || null;
};
