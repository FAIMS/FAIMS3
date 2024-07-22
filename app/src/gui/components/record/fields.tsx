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
 * Filename: view.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Field, FormikProps} from 'formik';

import {getComponentByName} from '../../component_registry';

export function getComponentFromFieldConfig(
  fieldConfig: any,
  fieldName: string,
  formProps: FormikProps<{[key: string]: unknown}>,
  isSyncing = 'false',
  disabled = false
) {
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  let Component: React.Component;
  try {
    Component = getComponentByName(namespace, name);
  } catch (err) {
    console.warn(`Failed to load component ${namespace}::${name}`, err);
    return undefined;
  }
  let inputlabel = false;
  if (
    name === 'TextField' &&
    fieldConfig['component-parameters']['InputProps'] !== undefined &&
    fieldConfig['component-parameters']['InputProps']['type'] !== 'text'
  )
    inputlabel = true;
  return inputlabel ? (
    <Field
      component={Component}
      name={fieldName}
      data-testid={fieldName}
      value={formProps.values[fieldName]}
      {...fieldConfig['component-parameters']}
      {...fieldConfig['component-parameters']['InputProps']}
      {...fieldConfig['component-parameters']['SelectProps']}
      {...fieldConfig['component-parameters']['InputLabelProps']}
      {...fieldConfig['component-parameters']['FormHelperTextProps']}
      InputLabelProps={{shrink: true}} //e.g, TextField label for Date and email and number
      onWheel={(event: any) => event.target.blur()}
      onChange={(event: any) => {
        formProps.handleChange(event);
        formProps.setFieldValue('updateField', fieldName);
      }}
      disabled={disabled}
    />
  ) : (
    <Field
      component={Component} //e.g, TextField (default <input>)
      name={fieldName}
      data-testid={fieldName}
      value={formProps.values[fieldName]}
      {...fieldConfig['component-parameters']}
      {...fieldConfig['component-parameters']['InputProps']}
      {...fieldConfig['component-parameters']['SelectProps']}
      {...fieldConfig['component-parameters']['InputLabelProps']}
      {...fieldConfig['component-parameters']['FormHelperTextProps']}
      onWheel={(event: any) => event.target.blur()}
      onChange={(event: any) => {
        formProps.handleChange(event);
        formProps.setFieldValue('updateField', fieldName);
      }}
      issyncing={isSyncing}
      disabled={disabled}
    />
  );
}
