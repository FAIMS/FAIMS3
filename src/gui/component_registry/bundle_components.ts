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
import {Select as FAIMSSelect} from '../fields/select';
import {ActionButton} from '../fields/ActionButton';
import {TakePoint} from '../fields/TakePoint';
import {Checkbox as FAIMSCheckbox} from '../fields/checkbox';
import {RadioGroup as FAIMSRadioGroup} from '../fields/radio';
import {TemplatedStringField} from '../fields/TemplatedStringField';
import {BasicAutoIncrementer} from '../fields/BasicAutoIncrementer';
import {RelatedRecordSelector} from '../fields/RelatedRecordSelector';
import {registerComponent, setupComponentProperties} from './internals';

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
registerComponent(
  'formik-material-ui',
  'TextField',
  setupComponentProperties('', '', 'Simple', FormikTextField)
);
registerComponent(
  'formik-material-ui',
  'Select',
  setupComponentProperties('', '', 'Simple', FormikSelect)
);
registerComponent(
  'formik-material-ui',
  'RadioGroup',
  setupComponentProperties('', '', 'Simple', FormikRadioGroup)
);
registerComponent(
  'faims-custom',
  'Select',
  setupComponentProperties('', '', 'Simple', FAIMSSelect)
);
registerComponent(
  'faims-custom',
  'Checkbox',
  setupComponentProperties('', '', 'Simple', FAIMSCheckbox)
);
registerComponent(
  'faims-custom',
  'RadioGroup',
  setupComponentProperties('', '', 'Simple', FAIMSRadioGroup)
);
registerComponent(
  'faims-custom',
  'ActionButton',
  setupComponentProperties(
    'Action Button',
    'Do an action',
    'Test',
    ActionButton
  )
);
registerComponent(
  'faims-custom',
  'TakePoint',
  setupComponentProperties(
    'Take Point',
    'Take a GPS position',
    'Position',
    TakePoint
  )
);
registerComponent(
  'faims-custom',
  'TemplatedStringField',
  setupComponentProperties(
    'Templated String',
    'Build a value up from other fields',
    'Advanced',
    TemplatedStringField
  )
);
registerComponent(
  'faims-custom',
  'BasicAutoIncrementer',
  setupComponentProperties(
    'Basic AutoIncrementer',
    'A basic autoincrementer to help create identifiers',
    'Identifiers',
    BasicAutoIncrementer
  )
);
registerComponent(
  'faims-custom',
  'RelatedRecordSelector',
  setupComponentProperties(
    'Related field',
    'Add relations between records',
    'Relations',
    RelatedRecordSelector
  )
);
