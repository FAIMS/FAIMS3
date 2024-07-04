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

const fields: {[key: string]: FieldType } = {
  'TextField': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: 'Helper Text',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'text',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Text Field',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'Email': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Email',
    'component-parameters': {
      fullWidth: true,
      helperText: 'We can also store Email addresses.',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'email',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Email',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string'], ['yup.email', 'Enter a valid email']],
    initialValue: '',
  },
  'Number': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      fullWidth: true,
      helperText: 'We have fields for storing Numbers.',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'number',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Number field',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.number']],
    initialValue: '',
  },
  'ControlledNumber': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      fullWidth: true,
      helperText: 'This number must be at least 10 and not more than 20.',
      variant: 'outlined',
      required: true,
      InputProps: {
        type: 'number',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Controlled number',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.number'], ['yup.min', 10, 'Must be 10 or more'], ['yup.max', 20, 'Must be 20 or less'], ['yup.required', 'You must fill this in!']],
    initialValue: '',
  },
  'BasicAutoIncrementer': {
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
    initialValue: null,
  },
  'MultipleTextField': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'MultipleTextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: 'Helper Text',
      variant: 'outlined',
      required: false,
      multiline: true,
      InputProps: {
        type: 'text',
        rows: 4,
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Text Field',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'Checkbox': {
    'component-namespace': 'faims-custom',
    'component-name': 'Checkbox',
    'type-returned': 'faims-core::Bool',
    'component-parameters': {
      name: 'checkbox-field',
      id: 'checkbox-field',
      required: false,
      type: 'checkbox',
      FormControlLabelProps: {
        label: 'Terms and Conditions',
      },
      FormHelperTextProps: {
        children: 'Read the terms and conditions carefully.',
      },
      // Label: {label: 'Terms and Conditions'},
    },
    validationSchema: [
      ['yup.bool'],
    ],
    initialValue: false,
  },
  'DateTimeNow': {
    'component-namespace': 'faims-custom',
    'component-name': 'DateTimeNow',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText:
        'Add a datetime stamp (click now to record the current date+time)',
      variant: 'outlined',
      required: false,
      InputLabelProps: {
        label: 'DateTimeNow Field',
      },
      is_auto_pick: false,
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'DatePicker': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      fullWidth: true,
      helperText: 'We have a date picker with a calendar prompt.',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'date',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Date picker',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'DateTimePicker': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Datetime',
    'component-parameters': {
      fullWidth: true,
      helperText: 'And a calendar prompt with a timestamp.',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'datetime-local',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Date and Time picker',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'MonthPicker': {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Date',
    'component-parameters': {
      fullWidth: true,
      helperText: 'And one to select just the month if that is all you need.',
      variant: 'outlined',
      required: false,
      InputProps: {
        type: 'month',
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Month picker',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'FileUploader': {
    'component-namespace': 'faims-custom',
    'component-name': 'FileUploader',
    'type-returned': 'faims-attachment::Files',
    'component-parameters': {
      name: 'file-upload-field',
      id: 'file-upload-field',
      helperText: 'Choose a file',
    },
    validationSchema: [['yup.mixed']],
    initialValue: null,
  },
  'MapFormField': {
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
      label: '',
      geoTiff: '',
    },
    validationSchema: [['yup.string']],
    initialValue: '1',
  },
  'MultiSelect': {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'MultiSelect',
    'type-returned': 'faims-core::Array', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'Choose items from the dropdown',
      variant: 'outlined',
      required: false,
      select: true,
      InputProps: {},
      SelectProps: {
        multiple: true,
      },
      ElementProps: {
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
      InputLabelProps: {
        label: 'Select Multiple',
      },
    },
    validationSchema: [['yup.array']],
    initialValue: [],
  },
  'RadioGroup': {
    'component-namespace': 'faims-custom',
    'component-name': 'RadioGroup',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'radio-group-field',
      id: 'radio-group-field',
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
      FormLabelProps: {
        children: 'Pick a number',
      },
      FormHelperTextProps: {
        children: 'Make sure you choose the right one!',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '1',
  },
  'RandomStyle': {
    'component-namespace': 'faims-custom',
    'component-name': 'RandomStyle',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: 'This is sub Title',
      variant: 'outlined',
      label: 'Title',
      variant_style: 'h5',
      html_tag: '',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'RichText': {
    'component-namespace': 'faims-custom',
    'component-name': 'RichText',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label: 'Unused',
      content: 'Hello __World__',
    }
  },
  'RelatedRecordSelector': {
    'component-namespace': 'faims-custom',
    'component-name': 'RelatedRecordSelector',
    'type-returned': 'faims-core::Relationship',
    'component-parameters': {
      fullWidth: true,
      helperText: 'Select or add new related record',
      variant: 'outlined',
      required: true,
      related_type: '',
      relation_type: 'faims-core::Child',
      InputProps: {
        type: 'text', // must be a valid html type
      },
      multiple: false,
      SelectProps: {},
      InputLabelProps: {
        label: 'Select Related',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'Select': {
    'component-namespace': 'faims-custom',
    'component-name': 'Select',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: 'Choose a field from the dropdown',
      variant: 'outlined',
      required: false,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [],
      },
      // select_others:'otherswith',
      InputLabelProps: {
        label: 'Select Field',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'AdvancedSelect': {
    'component-namespace': 'faims-custom',
    'component-name': 'AdvancedSelect',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      helperText: 'Select from list',
      variant: 'outlined',
      required: false,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        optiontree: [{
          name: 'Default',
          children: [],
        }],
      },
      // select_others:'otherswith',
      label: 'Select Field',
      valuetype: 'full',
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  },
  'TakePhoto': {
    'component-namespace': 'faims-custom',
    'component-name': 'TakePhoto',
    'type-returned': 'faims-attachment::Files',
    'component-parameters': {
      fullWidth: true,
      name: 'take-photo-field',
      id: 'take-photo-field',
      helperText: 'Take a photo',
      variant: 'outlined',
      label: 'Take Photo',
    },
    validationSchema: [['yup.object'], ['yup.nullable']],
    initialValue: null,
  },
  'TakePoint': {
    'component-namespace': 'faims-custom',
    'component-name': 'TakePoint',
    'type-returned': 'faims-pos::Location',
    'component-parameters': {
      fullWidth: true,
      name: 'take-point-field',
      id: 'take-point-field',
      helperText: 'Click to save current location',
      variant: 'outlined',
      label: 'Take point',
    },
    validationSchema: [['yup.object'], ['yup.nullable']],
    initialValue: null,
  },
  'TemplatedStringField': {
    'component-namespace': 'faims-custom',
    'component-name': 'TemplatedStringField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      fullWidth: true,
      name: 'hrid-field',
      id: 'hrid-field',
      helperText: 'Human Readable ID',
      variant: 'outlined',
      required: true,
      template: ' {{}}',
      InputProps: {
        type: 'text', // must be a valid html type
      },
      InputLabelProps: {
        label: 'Human Readable ID',
      },
      hrid: true,
    },
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: '',
  },
  'QRCodeFormField': {
    'component-namespace': 'qrcode',
    'component-name': 'QRCodeFormField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: 'qr-code-field',
      id: 'qr-code-field',
      variant: 'outlined',
      required: false,
      label: 'Scan QR Code',
      FormLabelProps: {
        children: 'Input a value here',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '1',
  },
}

export const getFieldNames = () => {
  return Object.keys(fields);
}

// Return a copy of the spec for this field type
export const getFieldSpec = (fieldType: string) => {
  return JSON.parse(JSON.stringify(fields[fieldType])) as FieldType;
}
