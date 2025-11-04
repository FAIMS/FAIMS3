import React, {createElement} from 'react';
import {EncodedFieldSpecification, FaimsForm} from '../../types';
import {getFieldInfo} from '../fields';

interface FieldProps {
  fieldSpec: EncodedFieldSpecification;
  form: FaimsForm;
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
