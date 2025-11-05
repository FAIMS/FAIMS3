import React, {useMemo} from 'react';
import {EncodedFieldSpecification, FaimsForm} from './types';
import {getFieldInfo} from '../fieldRegistry/registry';

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

  // Only reload the field info when needed
  const fieldInfo = useMemo(
    () =>
      getFieldInfo({
        namespace: props.fieldSpec['component-namespace'],
        name: props.fieldSpec['component-name'],
      }),
    [props.fieldSpec]
  );

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
