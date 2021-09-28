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
 * Filename: view.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Field, FormikProps} from 'formik';

import {Box} from '@material-ui/core';

import {getComponentByName} from '../../component_registry';
import DraftState from '../../../sync/draft-state';

export function getComponentFromFieldConfig(
  fieldConfig: any,
  fieldName: string,
  formProps: FormikProps<{[key: string]: unknown}>,
  draftstate: DraftState
) {
  // console.log('getComponentFromFieldConfig');
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  let Component: React.Component;
  try {
    Component = getComponentByName(namespace, name);
  } catch (err) {
    // console.debug(err);
    // console.warn(`Failed to load component ${namespace}::${name}`);
    return undefined;
  }
  return (
    <Box mb={3} key={fieldName}>
      <Field
        component={Component} //e.g, TextField (default <input>)
        name={fieldName}
        onChange={draftstate.createNativeFieldHook<
          React.ChangeEvent<{name: string}>,
          ReturnType<typeof formProps.handleChange>
        >(formProps.handleChange, fieldName)}
        onBlur={draftstate.createNativeFieldHook<
          React.FocusEvent<{name: string}>,
          ReturnType<typeof formProps.handleBlur>
        >(formProps.handleBlur, fieldName)}
        stageValue={draftstate.createCustomFieldHook(
          formProps.setFieldValue,
          fieldName
        )}
        value={formProps.values[fieldName]}
        {...fieldConfig['component-parameters']}
        {...fieldConfig['component-parameters']['InputProps']}
        {...fieldConfig['component-parameters']['SelectProps']}
        {...fieldConfig['component-parameters']['InputLabelProps']}
        {...fieldConfig['component-parameters']['FormHelperTextProps']}
      />
    </Box>
  );
}
