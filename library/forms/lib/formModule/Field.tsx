import {
  FaimsAttachments,
  FormAnnotation,
  FormDataEntry,
} from '@faims3/data-model';
import React, {useMemo} from 'react';
import {getFieldInfo} from '../fieldRegistry/registry';
import {FieldAnnotation} from './Annotation';
import {FormConfig} from './FormManager';
import {
  BaseFieldProps,
  EncodedFieldSpecification,
  FaimsForm,
  FaimsFormFieldState,
} from './types';

interface FieldProps {
  fieldSpec: EncodedFieldSpecification;
  form: FaimsForm;
  config: FormConfig;
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
      children={field => {
        const setFieldData = (value: any) => {
          const newValue: FormDataEntry = {
            ...(field.state.value || {}),
            data: value,
          };
          field.handleChange(newValue as any);
        };
        const setFieldAnnotation = (value: FormAnnotation) => {
          const newValue: FormDataEntry = {
            ...(field.state.value || {}),
            annotation: value,
          };
          field.handleChange(newValue as any);
        };
        const setFieldAttachment = (value: FaimsAttachments) => {
          const newValue: FormDataEntry = {
            ...(field.state.value || {}),
            attachments: value,
          };
          field.handleChange(newValue as any);
        };

        return (
          <>
            <Component
              {...(props.fieldSpec['component-parameters'] as BaseFieldProps)}
              // TODO fix the typing here - I think there is a minor issue
              state={field.state as unknown as FaimsFormFieldState}
              config={props.config}
              setFieldData={setFieldData}
              setFieldAnnotation={setFieldAnnotation}
              setFieldAttachment={setFieldAttachment}
              handleBlur={field.handleBlur}
            />
            <FieldAnnotation
              config={props.fieldSpec.meta}
              state={field.state as any} // avoid Typescript complaint
              setFieldAnnotation={setFieldAnnotation}
            />
          </>
        );
      }}
    />
  );
});
