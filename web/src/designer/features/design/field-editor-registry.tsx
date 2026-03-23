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

export type FieldEditorRenderContext = {
  fieldName: string;
  viewId: string;
  viewSetId: string;
};

export type FieldEditorRenderer = (
  context: FieldEditorRenderContext
) => React.ReactElement;

const selectEditorRenderer: FieldEditorRenderer = ({fieldName}) => (
  <OptionsEditor fieldName={fieldName} />
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

export const getFieldEditorRenderer = (
  fieldComponent: string
): FieldEditorRenderer | undefined => fieldEditorRegistry[fieldComponent];

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
