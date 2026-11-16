// SPDX-License-Identifier: Apache-2.0
import {
  BaseFieldParameters,
  FormAnnotation,
  FormUpdateData,
  ValuesObject,
} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import React, {createContext} from 'react';
import {FormConfig} from './formManagers/types';

export type FaimsFormData = FormUpdateData | undefined;

// Extract the Field type from the form instance
type ExtractFieldType<T> = T extends {
  Field: React.ComponentType<infer P>;
}
  ? P extends {children: (field: infer F) => any}
    ? F
    : never
  : never;

// We don't actually use this - but it is a way to let Typescript infer the type
// we need
const useMyForm = () =>
  useForm({
    defaultValues: {} as FaimsFormData,
  });
export type FaimsForm = ReturnType<typeof useMyForm>;
export type FaimsFormField = ExtractFieldType<FaimsForm>;
export type FaimsFormFieldState = FaimsFormField['state'];

// These are the additional FaimsForm props passed
export interface SetFieldDataFn {
  (value: any): void;
  (updater: (prev: any) => any): void;
}

/**
 * Live `buildConditionValues` bag for option-level visibility (siblings,
 * parent, linked records, notebook metadata). Form managers publish it so
 * choice fields can re-filter when some *other* value changes — TanStack
 * `form.Field` only re-renders on this field's own state.
 *
 * Empty outside a form manager; unit tests pass `conditionValues` as a prop.
 */
export const ConditionValuesContext = createContext<ValuesObject>({});

export type FormFieldContextProps = {
  // Which field is being rendered?
  fieldId: string;
  state: FaimsFormFieldState;
  /**
   * Value bag for option-level visibility conditions. Same shape as field and
   * section conditions (`buildConditionValues`). Supplied live via
   * {@link ConditionValuesContext} in form managers; optional so unit tests
   * can pass a snapshot (or omit it when no option is conditioned).
   */
  conditionValues?: ValuesObject;
  /**
   * Update the field's data value.
   *
   * You can either:
   * - pass a new value directly, or
   * - pass an updater function `(prev: any) => any` for race-safe concurrent updates.
   */
  setFieldData: SetFieldDataFn;
  setFieldAnnotation: (value: FormAnnotation) => void;
  // Add new attachment (at start of attachment list)
  addAttachment: (params: {
    // Blob content
    blob?: Blob;
    // Base64 content
    base64?: string;
    contentType: string;
    // This informs how to name things
    type: 'photo' | 'file';
    // This informs the file format in the file system e.g. pdf
    fileFormat: string;
  }) => Promise<string>;
  // Delete an attachment with given ID
  removeAttachment: (params: {attachmentId: string}) => Promise<void>;
  /**
   * Report that this field is saving an attachment (blocks section navigation).
   * Only present in full form mode.
   */
  setAttachmentSaving?: (saving: boolean) => void;
  handleBlur: () => void;
  config: FormConfig;
  /** Special behavior triggers */
  trigger: {
    /** Force a commit/save of the current record */
    commit: () => Promise<void>;
  };
};

export type FullFieldProps = BaseFieldParameters & FormFieldContextProps;

export type {CompletionResult} from '@faims3/data-model';
