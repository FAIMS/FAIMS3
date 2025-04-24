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

import {FieldType} from './state/initial';

const fields: {[key: string]: FieldType} = {
  FAIMSTextField: {
    'component-namespace': 'faims-custom',
    'component-name': 'FAIMSTextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'FAIMS Text Field',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  Email: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Email',
    'component-parameters': {
      label: 'Email',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'email',
      },
    },
    validationSchema: [['yup.string'], ['yup.email', 'Enter a valid email']],
    initialValue: '',
  },
  Number: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      label: 'Number field',
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'number',
      },
    },
    validationSchema: [['yup.number']],
    initialValue: '',
  },
  ControlledNumber: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      label: 'Controlled number',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'number',
      },
    },
    validationSchema: [
      ['yup.number'],
      ['yup.min', 10, 'Must be 10 or more'],
      ['yup.max', 20, 'Must be 20 or less'],
    ],
    initialValue: '',
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
      form_id: 'default', // will be set to the viewId when inserted into the form
      label: 'Auto Incrementing Field',
    },
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: '',
  },
  MultipleTextField: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'MultipleTextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Text Field',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      multiline: true,
      InputProps: {
        type: 'text',
        rows: 4,
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  Checkbox: {
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
    validationSchema: [['yup.bool']],
    initialValue: false,
  },
  DateTimeNow: {
    'component-namespace': 'faims-custom',
    'component-name': 'DateTimeNow',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Date and Time with Now button',
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: false,
      is_auto_pick: false,
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  DatePicker: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      label: 'Date picker',
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'date',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  DateTimePicker: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Datetime',
    'component-parameters': {
      label: 'Date and Time',
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'datetime-local',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  MonthPicker: {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      label: 'Month picker',
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'month',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
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
    validationSchema: [['yup.mixed']],
    initialValue: null,
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
      label: 'Select a Point',
      geoTiff: '',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  MultiSelect: {
    'component-namespace': 'faims-custom',
    'component-name': 'MultiSelect',
    'type-returned': 'faims-core::Array',
    'component-parameters': {
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
        expandedChecklist: false,
        options: [
          {
            value: 'Default',
            label: 'Default',
          },
          {
            value: 'Default2',
            label: 'Default2',
          },
        ],
      },
    },
    validationSchema: [['yup.array']],
    initialValue: [],
  },
  RadioGroup: {
    'component-namespace': 'faims-custom',
    'component-name': 'RadioGroup',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Select one option',
      name: 'radio-group-field',
      id: 'radio-group-field',
      advancedHelperText: '',
      variant: 'outlined',
      required: false,
      ElementProps: {
        options: [
          {
            value: '1',
            label: '1',
            RadioProps: {
              id: 'radio-group-field-1',
            },
          },
        ],
      },
      helperText: '',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  RandomStyle: {
    'component-namespace': 'faims-custom',
    'component-name': 'RandomStyle',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      label: 'Title',
      variant_style: 'h5',
      html_tag: '',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  RichText: {
    'component-namespace': 'faims-custom',
    'component-name': 'RichText',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Unused',
      content: 'Hello __World__',
    },
  },
  RelatedRecordSelector: {
    'component-namespace': 'faims-custom',
    'component-name': 'RelatedRecordSelector',
    'type-returned': 'faims-core::Relationship',
    'component-parameters': {
      label: 'Select Related',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: true,
      related_type: '',
      relation_type: 'faims-core::Child',
      multiple: false,
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  Select: {
    'component-namespace': 'faims-custom',
    'component-name': 'Select',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Select Field',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: false,
      ElementProps: {
        options: [],
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  AdvancedSelect: {
    'component-namespace': 'faims-custom',
    'component-name': 'AdvancedSelect',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Select Field',
      fullWidth: true,
      helperText: '',
      required: false,
      ElementProps: {
        optiontree: [
          {
            name: 'Default',
            children: [],
          },
        ],
      },
      valuetype: 'full',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
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
    validationSchema: [
      ['yup.array'],
      ['yup.of', [['yup.object'], ['yup.nullable']]],
      ['yup.nullable'],
    ],
    initialValue: null,
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
    validationSchema: [['yup.object'], ['yup.nullable']],
    initialValue: null,
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
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: '',
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
    validationSchema: [['yup.string']],
    initialValue: '',
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
    },
    validationSchema: [['yup.object'], ['yup.nullable']],
  },

  NumberField: {
    'component-namespace': 'faims-custom',
    'component-name': 'NumberField',
    'type-returned': 'faims-core::Number',
    'component-parameters': {
      label: 'Number Input',
      fullWidth: true,
      helperText: '',
      advancedHelperText: '',
      required: false,
      InputProps: {
        type: 'number',
      },
    },
    validationSchema: [['yup.number'], ['yup.nullable']],
    initialValue: null,
  },
};

export const getFieldNames = () => {
  return Object.keys(fields);
};

// Return a copy of the spec for this field type
export const getFieldSpec = (fieldType: string) => {
  return JSON.parse(JSON.stringify(fields[fieldType])) as FieldType;
};
