// SPDX-License-Identifier: Apache-2.0

/**
 * Public surface for per-field component-parameter schemas and their inferred
 * types. Each is defined once at its field module and surfaced here so the
 * designer can type its editors against the same contract the renderer uses.
 */

export {
  ChoiceElementPropsSchema,
  ChoiceOptionSchema,
  type ChoiceElementProps,
  type ChoiceOption,
} from './fields/choiceFieldParams';
export {TextFieldPropsSchema, type TextFieldProps} from './fields/TextFields';
export {
  NumberFieldPropsSchema,
  type NumberFieldProps,
} from './fields/NumberField';
export {
  dateTimePropsSchema,
  type DateTimeFieldProps,
} from './fields/DateFields';
export {
  PercentageSliderPropsSchema,
  type PercentageSliderProps,
} from './fields/PercentageSlider';
export {
  TakePointFieldPropsSchema,
  type TakePointFieldProps,
} from './fields/TakePoint';
export {
  AddressFieldPropsSchema,
  type AddressFieldProps,
} from './fields/AddressField';
export {MapFieldPropsSchema, type MapFieldProps} from './fields/MapField';
export {
  AdvancedSelectFieldPropsSchema,
  type AdvancedSelectFieldProps,
} from './fields/AdvancedSelect';
export {
  SelectFieldPropsSchema,
  type SelectFieldProps,
} from './fields/SelectField';
export {
  RadioGroupFieldPropsSchema,
  type RadioGroupFieldProps,
} from './fields/RadioGroup';
export {
  MultiSelectFieldPropsSchema,
  type MultiSelectFieldProps,
} from './fields/MultiSelect';
export {
  TemplatedStringPropsSchema,
  type TemplatedStringProps,
} from './fields/TemplatedStringField';
export {RichTextPropsSchema, type RichTextProps} from './fields/RichText';
export {
  relatedRecordPropsSchema,
  type RelatedRecordFieldProps,
  type RelatedRecordProps,
} from './fields/RelatedRecord/types';
