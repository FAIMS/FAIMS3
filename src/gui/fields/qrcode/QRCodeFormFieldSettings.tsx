/*
 * Copyright 2021 Macquarie University
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
 * Filename: QRCodeFormFieldSettings.tsx
 * Description:
 *   Implement Settings widget for QRCodeFormField
 */

import {ProjectUIModel} from '../../../datamodel/ui';

export const QRCodeFieldUISpec = {
  'component-namespace': 'qrcode', // this says what web component to use to render/acquire value from
  'component-name': 'QRCodeFormField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    name: 'radio-group-field',
    id: 'radio-group-field',
    variant: 'outlined',
    required: false,
    label: '',
    FormLabelProps: {
      children: 'Input a value here',
    },
  },
  validationSchema: [['yup.string']],
  initialValue: '1',
};

export const QRCodeFieldUISetting = (defaultSetting: ProjectUIModel) => {
  const newuiSetting = Object.assign({}, defaultSetting);

  return newuiSetting;
};
