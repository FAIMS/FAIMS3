import {createElement} from 'react';
import {getFieldInfo} from '../fields';
import React from 'react';
import {EncodedFieldSpecification} from '../../types';

interface FieldProps {
  fieldSpec: EncodedFieldSpecification;
}

export const Field = React.memo((props: FieldProps) => {
  console.log(
    'Rendering Field of type:',
    props.fieldSpec['component-namespace'],
    props.fieldSpec['component-name']
  );
  const fieldInfo = getFieldInfo({
    namespace: props.fieldSpec['component-namespace'],
    name: props.fieldSpec['component-name'],
  });
  if (!fieldInfo) {
    throw new Error(
      `Field type ${props.fieldSpec['component-namespace']}::${props.fieldSpec['component-name']} not registered`
    );
  }
  return createElement(
    fieldInfo.component,
    props.fieldSpec['component-parameters']
  );
});
