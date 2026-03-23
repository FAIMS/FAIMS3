import {FaimsAttachments} from '@faims3/data-model';
import {Alert} from '@mui/material';
import React, {useMemo} from 'react';
import {getFieldInfo} from '../fieldRegistry/registry';
import {logInfo} from '../logging';
import {FieldAnnotation} from './Annotation';
import {FormManagerConfig, FullFormManagerConfig} from './formManagers/types';
import {
  BaseFieldProps,
  EncodedFieldSpecification,
  FaimsForm,
  FaimsFormFieldState,
  FormAnnotation,
  FormDataEntry,
} from './types';
import {getFieldId} from './utils';

interface FieldProps {
  fieldId: string;
  fieldSpec: EncodedFieldSpecification;
  form: FaimsForm;
  config: FormManagerConfig;
}

export const Field = React.memo((props: FieldProps) => {
  // Only reload the field info when needed
  const {fieldInfo, fallback} = useMemo(
    () =>
      getFieldInfo({
        namespace: props.fieldSpec['component-namespace'],
        name: props.fieldSpec['component-name'],
      }),
    [props.fieldSpec]
  );

  // Rename here to prompt tsx it's a component
  const Component = fieldInfo?.component;

  return (
    <props.form.Field
      name={props.fieldSpec['component-parameters'].name}
      children={field => {
        const setFieldData = (value: any) => {
          // Allow functional updates for race-safe concurrent writes
          const current = (field.state.value || {}) as
            | FormDataEntry
            | undefined;
          const nextData =
            typeof value === 'function'
              ? value((current?.data ?? undefined) as any)
              : value;

          const newValue: FormDataEntry = {
            ...(current || {}),
            data: nextData,
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

        // TODO clean this up - duplicating the mode check here is ugly
        const addAttachmentHandler =
          props.config.mode === 'full'
            ? async (params: {
                blob?: Blob;
                base64?: string;
                contentType: string;
                type: 'photo' | 'file';
                fileFormat: string;
              }) => {
                return await (
                  props.config as FullFormManagerConfig
                ).attachmentHandlers.addAttachment({
                  ...params,
                  fieldId: props.fieldId,
                });
              }
            : async () => {
                logInfo('Mock addAttachment');
                return 'fakeId';
              };
        const removeAttachmentHandler =
          props.config.mode === 'full'
            ? async (params: {attachmentId: string}) => {
                return await (
                  props.config as FullFormManagerConfig
                ).attachmentHandlers.removeAttachment({
                  ...params,
                  fieldId: props.fieldId,
                });
              }
            : async () => {
                logInfo('Mock removeAttachment');
              };
        const setAttachmentSavingHandler =
          props.config.mode === 'full' &&
          (props.config as FullFormManagerConfig).attachmentHandlers
            .setAttachmentSaving
            ? (saving: boolean) =>
                (props.config as FullFormManagerConfig).attachmentHandlers
                  .setAttachmentSaving!(props.fieldId, saving)
            : undefined;
        const triggers =
          props.config.mode === 'full'
            ? props.config.trigger
            : {
                commit: async () => {
                  logInfo('Mock triggered commit() function.');
                },
              };
        return (
          <div id={getFieldId({fieldId: props.fieldId})}>
            {fallback && (
              <Alert severity="warning">
                The field type "{props.fieldSpec['component-name']}" is
                deprecated. Please update your form definition.
              </Alert>
            )}
            <Component
              {...(props.fieldSpec['component-parameters'] as BaseFieldProps)}
              // TODO fix the typing here - I think there is a minor issue but
              // it appears to functionally work
              state={field.state as unknown as FaimsFormFieldState}
              config={props.config}
              setFieldData={setFieldData}
              setFieldAnnotation={setFieldAnnotation}
              setFieldAttachment={setFieldAttachment}
              addAttachment={addAttachmentHandler}
              removeAttachment={removeAttachmentHandler}
              setAttachmentSaving={setAttachmentSavingHandler}
              handleBlur={field.handleBlur}
              fieldId={props.fieldId}
              trigger={triggers}
            />
            <FieldAnnotation
              config={props.fieldSpec.meta}
              state={field.state as any} // avoid Typescript complaint
              setFieldAnnotation={setFieldAnnotation}
            />
          </div>
        );
      }}
    />
  );
});
