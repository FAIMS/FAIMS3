import {createElement} from 'react';
import {registeredFieldTypes} from '../fields';
import React from 'react';

interface FieldProps {
  fieldType: string;
  [key: string]: any;
}
export const Field = React.memo((props: FieldProps) => {
  console.log('Rendering Field of type:', props.fieldType, props.name);
  const fieldInfo = registeredFieldTypes[props.fieldType];
  if (!fieldInfo) {
    throw new Error(`Field type ${props.fieldType} not registered`);
  }
  return createElement(fieldInfo.component, props);
});
