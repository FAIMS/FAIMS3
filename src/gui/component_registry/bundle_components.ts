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

import Input from '@mui/material/Input';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import {TextField as FormikTextField} from 'formik-mui';
import {Select as FormikSelect} from 'formik-mui';
import {RadioGroup as FormikRadioGroup} from 'formik-mui';
// import {CheckboxWithLabel as FormikCheckboxWithLabel} from 'formik-mui';

import {Select as FAIMSSelect} from '../fields/select';
import {AdvancedSelect} from '../fields/selectadvanced';
import {MultiSelect} from '../fields/multiselect';
import {ActionButton} from '../fields/ActionButton';
import {TakePoint} from '../fields/TakePoint';
import {Checkbox as FAIMSCheckbox} from '../fields/checkbox';
import {RadioGroup as FAIMSRadioGroup} from '../fields/radio';
import {TemplatedStringField} from '../fields/TemplatedStringField';
import {BasicAutoIncrementer} from '../fields/BasicAutoIncrementer';
import {RelatedRecordSelector} from '../fields/RelatedRecordSelector';
import {FileUploader} from '../fields/FileUploader';
import {TakePhoto} from '../fields/TakePhoto';

import {registerComponent, setupComponentProperties} from './internals';
import {RandomStyle} from '../fields/RandomStyle';
// Mapping plugin imports
import {MapFormField} from '../fields/maps/MapFormField';

import {DateTimeNow} from '../fields/DateTimeNow';

import {
  setAttachmentLoaderForType,
  setAttachmentDumperForType,
  file_data_to_attachments,
  file_attachments_to_data,
} from 'faims3-datamodel';
import {QRCodeFormField} from '../fields/qrcode';
import {RichTextField} from '../fields/RichText';

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
    FormikTextField
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
  setupComponentProperties('Select', 'Select one item', 'Select', FAIMSSelect)
);
registerComponent(
  'faims-custom',
  'MultiSelect',
  setupComponentProperties(
    'MultiSelect',
    'Select multiple items',
    'Select',
    MultiSelect
  )
);
registerComponent(
  'faims-custom',
  'AdvancedSelect',
  setupComponentProperties(
    'Hierarchical Select',
    'Hierarchical vocabularies pick',
    'Select',
    AdvancedSelect
  )
);
registerComponent(
  'faims-custom',
  'Checkbox',
  setupComponentProperties('Checkbox', 'Checkbox', 'Select', FAIMSCheckbox)
);
registerComponent(
  'faims-custom',
  'RadioGroup',
  setupComponentProperties('Radio', 'Radio', 'Select', FAIMSRadioGroup)
);
registerComponent(
  'faims-custom',
  'ActionButton',
  setupComponentProperties(
    'Action Button',
    'Do an action',
    'Special',
    ActionButton
  )
);
registerComponent(
  'faims-custom',
  'TakePoint',
  setupComponentProperties('Take Point', '', 'Special', TakePoint)
);
registerComponent(
  'faims-custom',
  'TakePhoto',
  setupComponentProperties('Take Photo', 'Take photo', 'Images', TakePhoto)
);
registerComponent(
  'faims-custom',
  'TemplatedStringField',
  setupComponentProperties(
    'Unique ID',
    'Build a value up from other fields',
    'Special',
    TemplatedStringField
  )
);
registerComponent(
  'faims-custom',
  'BasicAutoIncrementer',
  setupComponentProperties(
    'Basic AutoIncrementer',
    'A basic autoincrementer to help create identifiers',
    'Special',
    BasicAutoIncrementer
  )
);
registerComponent(
  'faims-custom',
  'RelatedRecordSelector',
  setupComponentProperties(
    'Related field',
    'Add relations between records',
    'Special',
    RelatedRecordSelector
  )
);

registerComponent(
  'qrcode',
  'QRCodeFormField',
  setupComponentProperties(
    'QR Code Scanning',
    'Scan a QR/Bar code',
    'QRCode',
    QRCodeFormField
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
    MapFormField
  )
);

registerComponent(
  'formik-material-ui',
  'MultipleTextField',
  setupComponentProperties(
    'Input Box',
    'Multiple line Input Box',
    'Text',
    FormikTextField
  )
);

registerComponent(
  'faims-custom',
  'FileUploader',
  setupComponentProperties(
    'File Upload',
    'Upload File',
    'Special',
    FileUploader
  )
);

registerComponent(
  'faims-custom',
  'RandomStyle',
  setupComponentProperties(
    'Title',
    'A sub Title for part',
    'Special',
    RandomStyle
  )
);

registerComponent(
  'faims-custom',
  'RichText',
  setupComponentProperties(
    'Rich Text',
    'Rich Text Editor',
    'Special',
    RichTextField
  )
);

registerComponent(
  'faims-custom',
  'DateTimeNow',
  setupComponentProperties(
    'DateTimeNow',
    'TZ-aware DateTime field with Now button',
    'Special',
    DateTimeNow
  )
);

/*
 * For saving and loading attachment with type faims-attachment::Files
 */

setAttachmentLoaderForType('faims-attachment::Files', file_attachments_to_data);
setAttachmentDumperForType('faims-attachment::Files', file_data_to_attachments);
