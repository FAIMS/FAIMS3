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
 * Filename: ComponentRegistry.ts
 * Description:
 *   TODO
 */

import React from 'react';
import Input from '@material-ui/core/Input';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';
import {TextField as FormikTextField} from 'formik-material-ui';
import {Select as FormikSelect} from 'formik-material-ui';
import {RadioGroup as FormikRadioGroup} from 'formik-material-ui';
// import {CheckboxWithLabel as FormikCheckboxWithLabel} from 'formik-material-ui';
import {Select as FAIMSSelect} from './fields/select';
import {ActionButton} from './fields/ActionButton';
import {TakePoint} from './fields/TakePoint';
import {Checkbox as FAIMSCheckbox} from './fields/checkbox';
import {RadioGroup as FAIMSRadioGroup} from './fields/radio';

const componentRegistry: {
  [namespace: string]: {[name: string]: React.Component};
} = {};

//export function NoSuchComponentNamespace(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponentNamespace';
//}
//
//export function NoSuchComponent(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponent';
//}

export function getComponentByName(namespace: string, componentName: string) {
  if (componentRegistry[namespace] === undefined) {
    throw new Error(`Unknown namespace ${namespace}`);
  }
  if (componentRegistry[namespace][componentName] === undefined) {
    throw new Error(`No component ${componentName} in namespace ${namespace}`);
  }
  return componentRegistry[namespace][componentName];
}

export function registerComponent(
  namespace: string,
  componentName: string,
  component: any
) {
  const n = getNameSpace(namespace);
  n[componentName] = component;
}

function getNameSpace(namespace: string) {
  if (componentRegistry[namespace] === undefined) {
    componentRegistry[namespace] = {};
  }
  return componentRegistry[namespace];
}

// This is temporary, need to work out how to best tie this in as a plugin
// system

registerComponent('core-material-ui', 'Input', Input);
registerComponent('core-material-ui', 'Checkbox', Checkbox);
registerComponent('core-material-ui', 'TextField', TextField);
registerComponent('formik-material-ui', 'TextField', FormikTextField);
registerComponent('formik-material-ui', 'Select', FormikSelect);
registerComponent('formik-material-ui', 'RadioGroup', FormikRadioGroup);
registerComponent('faims-custom', 'Select', FAIMSSelect);
registerComponent('faims-custom', 'Checkbox', FAIMSCheckbox);
registerComponent('faims-custom', 'RadioGroup', FAIMSRadioGroup);
registerComponent('faims-custom', 'ActionButton', ActionButton);
registerComponent('faims-custom', 'TakePoint', TakePoint);
