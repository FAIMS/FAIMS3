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
 * @file Canonical default {@link FieldType} templates keyed by internal type name (`component-name`).
 * Used by the field chooser and `fieldAdded` reducer via {@link getFieldSpec}.
 */

import {CategoryKey} from './field-categories';
import {FieldType} from './state/initial';

const fields: {[key: string]: FieldType} = {
  // Canonical "Text field" entry — new notebooks emit `faims-custom::TextField`.
  // Existing notebooks that still reference `FAIMSTextField` (or the legacy
  // `formik-material-ui::MultipleTextField`) are migrated to this canonical
  // name by `migrateToV4`; the runtime keeps a backward-compat alias for
  // un-migrated notebooks.
  TextField: {
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'text-field',
      label: 'Text field',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      speechAppendMode: false,
      enableSpeech: true,
    },
    initialValue: '',
    humanReadableName: 'Text field',
    humanReadableDescription:
      'Single or multi-line text input (short or long answer) with optional speech-to-text',
    category: CategoryKey.TEXT,
    showInChooser: true,
    order: 1,
  },

  DateTimePicker: {
    'component-namespace': 'faims-custom',
    'component-name': 'DateTimePicker',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'date-time-picker-field',
      label: 'Date and time picker',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      isAutoPick: false,
      show_now_button: false,
    },
    initialValue: '',
    humanReadableName: 'Date and time picker',
    humanReadableDescription: 'Select a calendar date and precise time',
    category: CategoryKey.DATETIME,
    showInChooser: true,
    order: 2,
  },

  DatePicker: {
    'component-namespace': 'faims-custom',
    'component-name': 'DatePicker',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      name: 'date-picker-field',
      label: 'Date only picker',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      show_now_button: false,
    },
    initialValue: '',
    humanReadableName: 'Date only picker',
    humanReadableDescription: 'Choose a calendar date (no time)',
    category: CategoryKey.DATETIME,
    showInChooser: true,
    order: 3,
  },

  MonthPicker: {
    'component-namespace': 'faims-custom',
    'component-name': 'MonthPicker',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      name: 'month-picker-field',
      label: 'Month only picker',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      show_now_button: false,
    },
    initialValue: '',
    humanReadableName: 'Month only picker',
    humanReadableDescription: 'Pick a month and year only',
    category: CategoryKey.DATETIME,
    showInChooser: true,
    order: 4,
  },

  BasicAutoIncrementer: {
    'component-namespace': 'faims-custom',
    'component-name': 'BasicAutoIncrementer',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'basic-autoincrementer-field',
      id: 'basic-autoincrementer-field',
      variant: 'outlined',
      required: true,
      num_digits: 5,
      form_id: 'default',
      label: 'Auto Incrementing Field',
    },
    initialValue: '',
    humanReadableName: 'Auto Incrementing Field',
    humanReadableDescription: 'Generates sequential IDs automatically',
    category: CategoryKey.NUMBERS,
    showInChooser: true,
    order: 9,
  },

  Checkbox: {
    // Hidden legacy chooser entry. v4 notebook migration rewrites every
    // `faims-custom::Checkbox` field to `faims-custom::RadioGroup` with
    // synthesised Yes/No options, so this template is only retained so
    // pre-migration field-spec lookups still resolve.
    'component-namespace': 'faims-custom',
    'component-name': 'Checkbox',
    'type-returned': 'faims-core::Bool',
    'component-parameters': {
      label: 'Checkbox',
      name: 'checkbox-field',
      id: 'checkbox-field',
      required: false,
      type: 'checkbox',
      helperText: '',
      advancedHelperText: '',
    },
    initialValue: false,
    humanReadableName: 'Checkbox',
    humanReadableDescription:
      'Deprecated boolean yes/no toggle — replaced by Select single with Yes/No options.',
    category: CategoryKey.CHOICE,
    deprecated: true,
    deprecationMessage:
      'Deprecated: existing Checkbox fields are migrated to "Select single" with Yes/No options automatically.',
    showInChooser: false,
    order: 11,
  },

  FileUploader: {
    'component-namespace': 'faims-custom',
    'component-name': 'FileUploader',
    'type-returned': 'faims-attachment::Files',
    'component-parameters': {
      label: 'Upload a File',
      name: 'file-upload-field',
      id: 'file-upload-field',
      helperText: '',
    },
    initialValue: null,
    humanReadableName: 'Upload a File',
    humanReadableDescription: 'Attach one or more files to the record',
    category: CategoryKey.MEDIA,
    showInChooser: true,
    order: 12,
  },

  AudioRecorder: {
    'component-namespace': 'faims-custom',
    'component-name': 'AudioRecorder',
    'type-returned': 'faims-attachment::Files',
    'component-parameters': {
      label: 'Audio Recorder',
      name: 'audio-recorder-field',
      helperText: '',
      advancedHelperText: '',
      required: false,
    },
    initialValue: null,
    humanReadableName: 'Audio Recorder',
    humanReadableDescription: 'Record and attach audio clips via microphone',
    category: CategoryKey.MEDIA,
    showInChooser: true,
    order: 13,
  },

  MapFormField: {
    'component-namespace': 'mapping-plugin',
    'component-name': 'MapFormField',
    'type-returned': 'faims-core::JSON',
    'component-parameters': {
      name: 'map-form-field',
      id: 'map-form-field',
      variant: 'outlined',
      required: false,
      featureType: 'Point',
      zoom: 12,
      label: 'Map Field',
      geoTiff: '',
    },
    initialValue: '',
    humanReadableName: 'Map Field',
    humanReadableDescription:
      'Interactive map for selecting a point, line or polygon',
    category: CategoryKey.LOCATION,
    showInChooser: true,
    order: 13,
  },

  MultiSelect: {
    'component-namespace': 'faims-custom',
    'component-name': 'MultiSelect',
    'type-returned': 'faims-core::Array',
    'component-parameters': {
      name: 'multi-select-field',
      label: 'Select Multiple',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      select: true,
      SelectProps: {
        multiple: true,
      },
      ElementProps: {
        // Default to expanded checklist mode; users can opt into compact dropdown.
        expandedChecklist: true,
        enableOtherOption: false,
        options: [
          {value: 'Default', label: 'Default'},
          {value: 'Default2', label: 'Default2'},
        ],
      },
    },
    initialValue: [],
    humanReadableName: 'Select multiple',
    humanReadableDescription:
      'Pick several options from a list (expanded checklist by default, optional dropdown)',
    category: CategoryKey.CHOICE,
    showInChooser: true,
    order: 14,
  },

  RadioGroup: {
    // This is the new primary "Select one" experience in field chooser.
    'component-namespace': 'faims-custom',
    'component-name': 'RadioGroup',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Select one',
      name: 'radio-group-field',
      id: 'radio-group-field',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      ElementProps: {
        enableOtherOption: false,
        options: [
          {value: '1', label: '1', RadioProps: {id: 'radio-group-field-1'}},
        ],
      },
      helperText: '',
    },
    initialValue: '',
    humanReadableName: 'Select single',
    humanReadableDescription:
      'Single-choice list (expanded checklist by default, optional dropdown display)',
    category: CategoryKey.CHOICE,
    showInChooser: true,
    order: 15,
  },

  RichText: {
    'component-namespace': 'faims-custom',
    'component-name': 'RichText',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'rich-text-field',
      label: 'Unused',
      content: 'Hello __World__',
    },
    humanReadableName: 'RichText',
    humanReadableDescription: 'Add formatted text to your form',
    category: CategoryKey.DISPLAY,
    showInChooser: true,
    order: 17,
  },

  RelatedRecordSelector: {
    'component-namespace': 'faims-custom',
    'component-name': 'RelatedRecordSelector',
    'type-returned': 'faims-core::Relationship',
    'component-parameters': {
      name: 'related-record-field',
      label: 'Select Related',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: true,
      related_type: '',
      relation_type: 'faims-core::Child',
      multiple: false,
      allowLinkToExisting: true,
      hideCreateAnotherButton: false,
    },
    humanReadableName: 'Add Related Record',
    humanReadableDescription: 'Add a child or other linked record',
    category: CategoryKey.RELATIONSHIP,
    showInChooser: true,
    order: 18,
  },

  Select: {
    // Hidden legacy chooser entry. v4 notebook migration rewrites every
    // `faims-custom::Select` field to `faims-custom::RadioGroup` (Select
    // single), preserving the existing options. Retained only so pre-
    // migration field-spec lookups still resolve.
    'component-namespace': 'faims-custom',
    'component-name': 'Select',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'select-field',
      label: 'Select one',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: false,
      ElementProps: {
        enableOtherOption: false,
        options: [],
      },
    },
    initialValue: '',
    humanReadableName: 'Select single (legacy dropdown)',
    humanReadableDescription:
      'Deprecated MUI-dropdown variant — replaced by Select single (radio).',
    category: CategoryKey.CHOICE,
    showInChooser: false,
    deprecated: true,
    deprecationMessage:
      'Deprecated: existing Select fields are migrated to "Select single" automatically.',
    order: 19,
  },

  AdvancedSelect: {
    'component-namespace': 'faims-custom',
    'component-name': 'AdvancedSelect',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'advanced-select-field',
      label: 'Select Field',
      fullWidth: true,
      helperText: '',
      required: false,
      ElementProps: {
        optiontree: [{name: 'Default', children: []}],
      },
      valuetype: 'full',
    },
    initialValue: '',
    humanReadableName: 'Select Field (Hierarchical)',
    humanReadableDescription: 'Hierarchical dropdown supporting nested options',
    category: CategoryKey.CHOICE,
    showInChooser: true,
    order: 20,
  },

  TakePhoto: {
    'component-namespace': 'faims-custom',
    'component-name': 'TakePhoto',
    'type-returned': 'faims-attachment::Files',
    'component-parameters': {
      name: 'take-photo-field',
      helperText: '',
      advancedHelperText: '',
      label: 'Take Photo',
    },
    initialValue: null,
    humanReadableName: 'Take Photo',
    humanReadableDescription: 'Capture and attach an image via camera',
    category: CategoryKey.MEDIA,
    showInChooser: true,
    order: 21,
  },

  TakePoint: {
    'component-namespace': 'faims-custom',
    'component-name': 'TakePoint',
    'type-returned': 'faims-pos::Location',
    'component-parameters': {
      name: 'take-point-field',
      helperText: '',
      label: 'Take point',
    },
    initialValue: null,
    humanReadableName: 'Take point',
    humanReadableDescription: 'Record GPS location coordinates',
    category: CategoryKey.LOCATION,
    showInChooser: true,
    order: 22,
  },

  TemplatedStringField: {
    'component-namespace': 'faims-custom',
    'component-name': 'TemplatedStringField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Templated String Field',
      fullWidth: true,
      name: 'templated-field',
      helperText: '',
      required: true,
      template: ' {{}}',
      hidden: true,
    },
    initialValue: '',
    humanReadableName: 'Templated String Field',
    humanReadableDescription: 'Auto-generates text from a template',
    category: CategoryKey.TEXT,
    showInChooser: true,
    order: 23,
  },

  QRCodeFormField: {
    'component-namespace': 'qrcode',
    'component-name': 'QRCodeFormField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'qr-code-field',
      required: false,
      label: 'Scan QR Code',
      helperText: '',
    },
    initialValue: '',
    humanReadableName: 'Scan QR Code',
    humanReadableDescription: 'Scan and store a QR-code value',
    category: CategoryKey.TEXT,
    showInChooser: true,
    order: 24,
  },

  AddressField: {
    'component-namespace': 'faims-custom',
    'component-name': 'AddressField',
    'type-returned': 'faims-core::JSON',
    'component-parameters': {
      helperText: '',
      required: false,
      name: 'Address',
      label: 'Address',
      // Optional config, defaults handled in forms for backwards compatibility
      enableAutoSuggestion: true,
      allowFullAddressManualEntry: false,
    },
    humanReadableName: 'Address',
    humanReadableDescription: 'Structured street address input',
    category: CategoryKey.TEXT,
    showInChooser: true,
    order: 25,
  },

  // Canonical "Number field" entry — new notebooks emit `faims-custom::NumberField`.
  // Existing notebooks that still reference `ControlledNumber` are migrated to
  // this canonical name by `migrateToV4`; the runtime keeps a backward-compat
  // alias for un-migrated notebooks.
  NumberField: {
    'component-namespace': 'faims-custom',
    'component-name': 'NumberField',
    'type-returned': 'faims-core::Number',
    'component-parameters': {
      name: 'number-field',
      label: 'Number field',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: false,
      numberType: 'integer',
      min: 0,
      max: 100,
      InputProps: {
        type: 'number',
      },
    },
    initialValue: null,
    humanReadableName: 'Number field',
    humanReadableDescription:
      'Numeric input with integer/decimal mode and optional minimum/maximum limits',
    category: CategoryKey.NUMBERS,
    showInChooser: true,
    order: 26,
  },

  EmailField: {
    'component-namespace': 'faims-custom',
    'component-name': 'Email',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'email-field',
      label: 'Email',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
    },
    initialValue: '',
    humanReadableName: 'Email',
    humanReadableDescription: 'Validates and captures an e-mail address',
    category: CategoryKey.TEXT,
    showInChooser: true,
    order: 6,
  },

  PercentageSlider: {
    'component-namespace': 'faims-custom',
    'component-name': 'PercentageSlider',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      label: 'Percentage',
      name: 'percentage-slider-field',
      helperText: '',
      advancedHelperText: '',
      required: false,
      min: 0,
      max: 100,
    },
    initialValue: null,
    humanReadableName: 'Percentage Slider',
    humanReadableDescription:
      'Slider for selecting a percentage with optional step',
    category: CategoryKey.NUMBERS,
    showInChooser: true,
    order: 27,
  },

  ComputedField: {
    'component-namespace': 'faims-custom',
    'component-name': 'ComputedField',
    'type-returned': 'faims-core::Number',
    'component-parameters': {
      label: 'Computed Value',
      fullWidth: true,
      name: 'computed-field',
      helperText: '',
      required: false,
      expression: '',
    },
    initialValue: null,
    humanReadableName: 'Computed Value',
    humanReadableDescription:
      'Calculates a number from an expression over other fields',
    category: CategoryKey.NUMBERS,
    showInChooser: true,
    order: 28,
  },
};

/** All registered field type keys (chooser + factory). */
export const getFieldNames = () => {
  return Object.keys(fields);
};

/**
 * Deep-clone the default {@link FieldType} for a template key.
 *
 * @param fieldType - Key in the `fields` map (e.g. `FAIMSTextField`).
 * @returns Clone of the template; invalid keys produce a clone of `undefined` (callers should validate).
 */
export const getFieldSpec = (fieldType: string) => {
  return JSON.parse(JSON.stringify(fields[fieldType])) as FieldType;
};
