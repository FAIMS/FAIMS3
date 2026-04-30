// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Maps `component-name` strings to the property editor UI for that field type.
 * Unknown types fall back to `BaseFieldEditor` in `renderFieldEditor`.
 */

import React from 'react';
import {AddressFieldEditor} from '../../components/Fields/AddressFieldEditor';
import {AdvancedSelectEditor} from '../../components/Fields/AdvancedSelectEditor';
import {BaseFieldEditor} from '../../components/Fields/BaseFieldEditor';
import {BasicAutoIncrementerEditor} from '../../components/Fields/BasicAutoIncrementer';
import {ControlledNumberFieldEditor} from '../../components/Fields/ControlledNumberFieldEditor';
import {DateTimeNowEditor} from '../../components/Fields/DateTimeNowEditor';
import {MapFormFieldEditor} from '../../components/Fields/MapFormFieldEditor';
import {MultipleTextFieldEditor} from '../../components/Fields/MultipleTextField';
import {NumberFieldEditor} from '../../components/Fields/NumberFieldEditor';
import {OptionsEditor} from '../../components/Fields/OptionsEditor';
import {RelatedRecordEditor} from '../../components/Fields/RelatedRecordEditor';
import {RichTextEditor} from '../../components/Fields/RichTextEditor';
import {TakePhotoFieldEditor} from '../../components/Fields/TakePhotoField';
import {TakePointFieldEditor} from '../../components/Fields/TakePointFieldEditor';
import {TemplatedStringFieldEditor} from '../../components/Fields/TemplatedStringFieldEditor';
import {TextFieldEditor} from '../../components/Fields/TextFieldEditor';

/** Identifiers passed into type-specific editors (e.g. HRID / related record context). */
export type FieldEditorRenderContext = {
  fieldName: string;
  viewId: string;
  viewSetId: string;
};

/** Factory that renders the inspector panel for one field type. */
export type FieldEditorRenderer = (
  context: FieldEditorRenderContext
) => React.ReactElement;

const selectEditorRenderer: FieldEditorRenderer = ({fieldName}) => (
  <OptionsEditor fieldName={fieldName} showExpandedChecklist={true} />
);

const multiSelectEditorRenderer: FieldEditorRenderer = ({fieldName}) => (
  <OptionsEditor
    fieldName={fieldName}
    showExpandedChecklist={true}
    showExclusiveOptions={true}
  />
);

export const fieldEditorRegistry: Record<string, FieldEditorRenderer> = {
  MultipleTextField: ({fieldName}) => (
    <MultipleTextFieldEditor fieldName={fieldName} />
  ),
  TakePhoto: ({fieldName}) => <TakePhotoFieldEditor fieldName={fieldName} />,
  TextField: ({fieldName}) => <TextFieldEditor fieldName={fieldName} />,
  DateTimeNow: ({fieldName}) => <DateTimeNowEditor fieldName={fieldName} />,
  DateTimePicker: ({fieldName}) => <DateTimeNowEditor fieldName={fieldName} />,
  Select: selectEditorRenderer,
  MultiSelect: multiSelectEditorRenderer,
  RadioGroup: selectEditorRenderer,
  AdvancedSelect: ({fieldName}) => (
    <AdvancedSelectEditor fieldName={fieldName} />
  ),
  MapFormField: ({fieldName}) => <MapFormFieldEditor fieldName={fieldName} />,
  AddressField: ({fieldName}) => <AddressFieldEditor fieldName={fieldName} />,
  TakePoint: ({fieldName}) => <TakePointFieldEditor fieldName={fieldName} />,
  NumberField: ({fieldName}) => <NumberFieldEditor fieldName={fieldName} />,
  ControlledNumber: ({fieldName}) => (
    <ControlledNumberFieldEditor fieldName={fieldName} />
  ),
  RichText: ({fieldName}) => <RichTextEditor fieldName={fieldName} />,
  RelatedRecordSelector: ({fieldName}) => (
    <RelatedRecordEditor fieldName={fieldName} />
  ),
  BasicAutoIncrementer: ({fieldName, viewId}) => (
    <BasicAutoIncrementerEditor fieldName={fieldName} viewId={viewId} />
  ),
  TemplatedStringField: ({fieldName, viewId, viewSetId}) => (
    <TemplatedStringFieldEditor
      fieldName={fieldName}
      viewId={viewId}
      viewsetId={viewSetId}
    />
  ),
};

/**
 * @param fieldComponent - Value of `FieldType['component-name']`.
 * @returns Registered renderer, or undefined if unmapped.
 */
export const getFieldEditorRenderer = (
  fieldComponent: string
): FieldEditorRenderer | undefined => fieldEditorRegistry[fieldComponent];

/**
 * Renders the appropriate editor for `fieldComponent`, or `BaseFieldEditor` if unknown.
 *
 * @param fieldComponent - Notebook component name key.
 * @param context - Current field / section / form ids.
 * @returns React element for the accordion body.
 */
export const renderFieldEditor = ({
  fieldComponent,
  context,
}: {
  fieldComponent: string;
  context: FieldEditorRenderContext;
}) => {
  const renderer = getFieldEditorRenderer(fieldComponent);
  if (!renderer) {
    return <BaseFieldEditor fieldName={context.fieldName} />;
  }
  return renderer(context);
};
