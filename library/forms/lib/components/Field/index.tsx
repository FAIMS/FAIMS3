import {createElement} from 'react';
import {getFieldInfo} from '../fields';
import React from 'react';
import {EncodedFieldSpecification} from '../../types';
import {useForm} from '@tanstack/react-form';

interface FieldProps {
  fieldSpec: EncodedFieldSpecification;
  form: ReturnType<typeof useForm>; // type of tanstack useForm is dynamic
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
  return (
    <props.form.Field
      name={props.fieldSpec['component-parameters'].name}
      children={field => {
        return createElement(fieldInfo!.component, {
          ...props.fieldSpec['component-parameters'],
          field: field,
        });
      }}
    />
  );
});
