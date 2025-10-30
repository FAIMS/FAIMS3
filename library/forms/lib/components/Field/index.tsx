import {createElement} from 'react';
import {registeredFieldTypes} from '../fields';

interface FieldProps {
  fieldType: string;
  [key: string]: any;
}
export const Field = (props: FieldProps) => {
  const fieldInfo = registeredFieldTypes[props.fieldType];
  if (!fieldInfo) {
    throw new Error(`Field type ${props.fieldType} not registered`);
  }
  return <div>{createElement(fieldInfo.component, props)}</div>;
};
