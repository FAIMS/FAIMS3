/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: bundle_components.ts
 * Description:
 *   TODO
 */

import Input from '@material-ui/core/Input';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';
import {TextField as FormikTextField} from 'formik-material-ui';
import {Select as FormikSelect} from 'formik-material-ui';
import {RadioGroup as FormikRadioGroup} from 'formik-material-ui';
// import {CheckboxWithLabel as FormikCheckboxWithLabel} from 'formik-material-ui';

import {
  Select as FAIMSSelect,
  SelectSetting,
  Selectcomponentsetting,
  getSelectBuilderIcon,
} from '../fields/select';
import {ActionButton, ActionSetting} from '../fields/ActionButton';
import {TakePoint, TakePointSetting} from '../fields/TakePoint';
import {
  Checkbox as FAIMSCheckbox,
  CheckboxSetting,
  getCheckBoxBuilderIcon,
} from '../fields/checkbox';
import {
  RadioGroup as FAIMSRadioGroup,
  RadioSetting,
  Radiocomponentsetting,
  getRadioBuilderIcon,
} from '../fields/radio';
import {
  TemplatedStringField,
  TemplatedStringSetting,
  TemplatedStringcomponentsetting,
  getTemplatedStringBuilderIcon,
} from '../fields/TemplatedStringField';
import {
  BasicAutoIncrementer,
  AutoSetting,
  getAutoBuilderIcon,
} from '../fields/BasicAutoIncrementer';
import {
  RelatedRecordSelector,
  LinkedSetting,
  getLinkedBuilderIcon,
  Linkedcomponentsetting,
} from '../fields/RelatedRecordSelector';
import {
  FileUploader,
  FileuploadSetting,
  getFileuploadBuilderIcon,
} from '../fields/FileUploader';
import {TakePhoto, TakePhotoSetting} from '../fields/TakePhoto';

import {registerComponent, setupComponentProperties} from './internals';
import {
  TextuiSpec,
  TextuiSetting,
  Defaultcomponentsetting,
  MultiTextuiSetting,
  MultiTextuiSpec,
} from '../fields/BasicFieldSettings';
// Mapping plugin imports
import {RandomStyle,RandomStyleSetting} from '../fields/RamdomStyle';
import {
  MapFormField,
  MapFieldUISetting,
  MapFieldUISpec,
} from '@faims-project/faims3-map-input';
import {getDefaultuiSetting} from '../fields/BasicFieldSettings';

const MapFieldBuilderSettings = [
  MapFieldUISetting(getDefaultuiSetting()),
  MapFieldUISpec,
];


import {
  setAttachmentLoaderForType,
  setAttachmentDumperForType,
} from '../../datamodel/typesystem';
import {
  file_data_to_attachments,
  file_attachments_to_data,
} from '../../data_storage/attachments';

/*
 * This should be enough to make typescript/the build system happy
 */
const bundle = null;
export default bundle;

// This is temporary, need to work out how to best tie this in as a plugin
// system

registerComponent(
  'core-material-ui',
  'Input',
  setupComponentProperties(
    'HTML input field',
    'Catchall field',
    'Advanced',
    Input
  )
);
registerComponent(
  'core-material-ui',
  'Checkbox',
  setupComponentProperties(
    'HTML checkbox field',
    'A simple checkbox',
    'Simple',
    Checkbox
  )
);
registerComponent(
  'core-material-ui',
  'TextField',
  setupComponentProperties(
    'HTML text field',
    'A simple text field',
    'Simple',
    TextField
  )
);
//this is for testing

registerComponent(
  'formik-material-ui',
  'TextField',
  setupComponentProperties(
    'Input field',
    'text plus special characters',
    'Text',
    FormikTextField,
    {
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      type_return: 'faims-core::String',
      validationSchema: [['yup.string']],
      type: 'text',
    },
    [TextuiSetting, TextuiSpec],
    Defaultcomponentsetting
  )
);

registerComponent(
  'formik-material-ui',
  'Select',
  setupComponentProperties('', '', 'Simple', FormikSelect)
);
registerComponent(
  'formik-material-ui',
  'RadioGroup',
  setupComponentProperties('Radio', 'Radio', 'Simple', FormikRadioGroup)
);
registerComponent(
  'faims-custom',
  'Select',
  setupComponentProperties(
    'Select',
    'Select',
    'Select',
    FAIMSSelect,
    {
      namespace: 'faims-custom',
      componentName: 'Select',
      select: true,
      type_return: 'faims-core::String',
      validationSchema: [['yup.string']],
      type: 'select',
    },
    SelectSetting,
    Selectcomponentsetting,
    getSelectBuilderIcon()
  )
);
registerComponent(
  'faims-custom',
  'Checkbox',
  setupComponentProperties(
    'Checkbox',
    'Checkbox',
    'Select',
    FAIMSCheckbox,
    {
      namespace: 'faims-custom',
      componentName: 'Checkbox',
      type_return: 'faims-core::Bool',
      validationSchema: [['yup.bool']],
      type: 'checkbox',
    },
    CheckboxSetting,
    Defaultcomponentsetting,
    getCheckBoxBuilderIcon()
  )
);
registerComponent(
  'faims-custom',
  'RadioGroup',
  setupComponentProperties(
    'Radio',
    'Radio',
    'Select',
    FAIMSRadioGroup,
    {
      ...RadioSetting[1],
      namespace: 'faims-custom',
      componentName: 'RadioGroup',
    },
    RadioSetting,
    Radiocomponentsetting,
    getRadioBuilderIcon()
  )
);
registerComponent(
  'faims-custom',
  'ActionButton',
  setupComponentProperties(
    'Action Button',
    'Do an action',
    'Special',
    ActionButton,
    {
      namespace: 'faims-custom',
      componentName: 'ActionButton',
      type_return: 'faims-core::String',
      validationSchema: [['yup.string']],
      type: 'string',
    },
    ActionSetting,
    Defaultcomponentsetting
  )
);
registerComponent(
  'faims-custom',
  'TakePoint',
  setupComponentProperties(
    'Take Point',
    '',
    'Special',
    TakePoint,
    {
      namespace: 'faims-custom',
      componentName: 'TakePoint',
      type_return: 'faims-pos::Location',
      initialValue: null,
      validationSchema: [
        ['yup.object'],
        ['yup.nullable'],
        [
          'yup.shape',
          {
            latitude: [['yup.number'], ['yup.required']],
            longitude: [['yup.number'], ['yup.required']],
          },
        ],
      ],
    },
    TakePointSetting,
    Defaultcomponentsetting
  )
);
registerComponent(
  'faims-custom',
  'TakePhoto',
  setupComponentProperties(
    'Take Photo',
    'Take photo',
    'Images',
    TakePhoto,
    {
      namespace: 'faims-custom',
      componentName: 'TakePhoto',
      type_return: 'faims-attachment::Files',
      initialValue: null,
      validationSchema: [['yup.object'], ['yup.nullable']],
    },
    TakePhotoSetting,
    Defaultcomponentsetting
  )
);
registerComponent(
  'faims-custom',
  'TemplatedStringField',
  setupComponentProperties(
    'Unique ID',
    'Build a value up from other fields',
    'Special',
    TemplatedStringField,
    {
      namespace: 'faims-custom',
      componentName: 'TemplatedStringField',
      type_return: 'faims-core::String',
      required: true,
      validationSchema: [['yup.string'], ['yup.required']],
      type: 'text',
      template: 'αβγ {{str-field}}-{{basic-autoincrementer-field}}',
    },
    TemplatedStringSetting,
    TemplatedStringcomponentsetting,
    getTemplatedStringBuilderIcon()
  )
);
registerComponent(
  'faims-custom',
  'BasicAutoIncrementer',
  setupComponentProperties(
    'Basic AutoIncrementer',
    'A basic autoincrementer to help create identifiers',
    'Special',
    BasicAutoIncrementer,
    AutoSetting[1],
    AutoSetting,
    Defaultcomponentsetting,
    getAutoBuilderIcon()
  )
);
registerComponent(
  'faims-custom',
  'RelatedRecordSelector',
  setupComponentProperties(
    'Related field',
    'Add relations between records',
    'Special',
    RelatedRecordSelector,
    LinkedSetting[1],
    LinkedSetting,
    Linkedcomponentsetting,
    getLinkedBuilderIcon()
  )
);
// Mapping Plugin registration

registerComponent(
  'mapping-plugin',
  'MapFormField',
  setupComponentProperties(
    'Map Input Field',
    'Input Geo Data via a map',
    'Maps',
    MapFormField,
    MapFieldBuilderSettings[1],
    MapFieldBuilderSettings,
    Defaultcomponentsetting
  )
);

registerComponent(
  'formik-material-ui',
  'MultipleTextField',
  setupComponentProperties(
    'Input Box',
    'Multiple line Input Box',
    'Text',
    FormikTextField,
    {
      namespace: 'formik-material-ui',
      componentName: 'MultipleTextField',
      type_return: 'faims-core::String',
      validationSchema: [['yup.string']],
      type: 'text',
      multiline: true,
      multirows: 4,
    },
    [MultiTextuiSetting, MultiTextuiSpec],
    Defaultcomponentsetting
  )
);

registerComponent(
  'faims-custom',
  'FileUploader',
  setupComponentProperties(
    'File Upload',
    'Upload File',
    'Special',
    FileUploader,
    FileuploadSetting[1],
    FileuploadSetting,
    Defaultcomponentsetting,
    getFileuploadBuilderIcon()
  )
);

registerComponent(
  'faims-custom',
  'RandomStyle',
  setupComponentProperties(
    'Title',
    'A sub Title for part',
    'Special',
    RandomStyle,
    RandomStyleSetting[1],
    RandomStyleSetting,
    Defaultcomponentsetting,
    getAutoBuilderIcon()
  )
);

/*
 * For saving and loading attachment with type faims-core::File
 */

setAttachmentLoaderForType('faims-attachment::Files', file_attachments_to_data);
setAttachmentDumperForType('faims-attachment::Files', file_data_to_attachments);
