import React from 'react';
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

  // Rename here to prompt tsx it's a component
  const Component = fieldInfo.component;

  return (
    <props.form.Field
      name={props.fieldSpec['component-parameters'].name}
      children={field => (
        <Component {...props.fieldSpec['component-parameters']} field={field} />
      )}
    />
  );
});
