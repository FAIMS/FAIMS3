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
import {registerField} from './internals';
import {RandomStyle} from '../fields/RandomStyle';
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

const bundle = null;
export default bundle;

registerField(
  'core-material-ui',
  'Input',
  'HTML input field',
  'Catchall field',
  'Advanced',
  Input
);

registerField(
  'core-material-ui',
  'Checkbox',
  'HTML checkbox field',
  'A simple checkbox',
  'Simple',
  Checkbox
);

registerField(
  'core-material-ui',
  'TextField',
  'HTML text field',
  'A simple text field',
  'Simple',
  TextField
);

registerField(
  'formik-material-ui',
  'TextField',
  'Input field',
  'text plus special characters',
  'Text',
  FormikTextField
);

registerField(
  'formik-material-ui',
  'Select',
  'Select Field',
  'Text',
  'Simple',
  FormikSelect
);

registerField(
  'formik-material-ui',
  'RadioGroup',
  'Radio',
  'Radio',
  'Simple',
  FormikRadioGroup
);

registerField(
  'faims-custom',
  'Select',
  'Select',
  'Select one item',
  'Select',
  FAIMSSelect
);

registerField(
  'faims-custom',
  'MultiSelect',
  'MultiSelect',
  'Select multiple items',
  'Select',
  MultiSelect
);

registerField(
  'faims-custom',
  'AdvancedSelect',
  'Hierarchical Select',
  'Hierarchical vocabularies pick',
  'Select',
  AdvancedSelect
);

registerField(
  'faims-custom',
  'Checkbox',
  'Checkbox',
  'Checkbox',
  'Select',
  FAIMSCheckbox
);

registerField(
  'faims-custom',
  'RadioGroup',
  'Radio',
  'Radio',
  'Select',
  FAIMSRadioGroup
);

registerField(
  'faims-custom',
  'ActionButton',
  'Action Button',
  'Do an action',
  'Special',
  ActionButton
);

registerField(
  'faims-custom',
  'TakePoint',
  'Take Point',
  'Capture the current GPS location',
  'Special',
  TakePoint
);

registerField(
  'faims-custom',
  'TakePhoto',
  'Take Photo',
  'Use the camera to take a photo',
  'Images',
  TakePhoto
);

registerField(
  'faims-custom',
  'TemplatedStringField',
  'Unique ID',
  'Build a value up from other fields',
  'Special',
  TemplatedStringField
);

registerField(
  'faims-custom',
  'BasicAutoIncrementer',
  'Basic AutoIncrementer',
  'A basic autoincrementer to help create identifiers',
  'Special',
  BasicAutoIncrementer
);

registerField(
  'faims-custom',
  'RelatedRecordSelector',
  'Related field',
  'Add relations between records',
  'Special',
  RelatedRecordSelector
);

registerField(
  'qrcode',
  'QRCodeFormField',
  'QR Code Scanning',
  'Scan a QR/Bar code',
  'QRCode',
  QRCodeFormField
);

// Mapping Plugin registration

registerField(
  'mapping-plugin',
  'MapFormField',
  'Map Input Field',
  'Input Geo Data via a map',
  'Maps',
  MapFormField
);

registerField(
  'formik-material-ui',
  'MultipleTextField',
  'Input Box',
  'Multiple line Input Box',
  'Text',
  FormikTextField
);

registerField(
  'faims-custom',
  'FileUploader',
  'File Upload',
  'Upload File',
  'Special',
  FileUploader
);

registerField(
  'faims-custom',
  'RandomStyle',
  'Title',
  'A sub Title for part',
  'Special',
  RandomStyle
);

registerField(
  'faims-custom',
  'RichText',
  'Rich Text',
  'Rich Text Editor',
  'Special',
  RichTextField
);

registerField(
  'faims-custom',
  'DateTimeNow',
  'DateTimeNow',
  'TZ-aware DateTime field with Now button',
  'Special',
  DateTimeNow
);

/*
 * For saving and loading attachment with type faims-attachment::Files
 */

setAttachmentLoaderForType('faims-attachment::Files', file_attachments_to_data);
setAttachmentDumperForType('faims-attachment::Files', file_data_to_attachments);
