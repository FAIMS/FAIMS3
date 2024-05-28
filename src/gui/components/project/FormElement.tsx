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
 * Filename: FormElement.tsx
 * Description: generate a component for a field
 */

import React from 'react';
import {Field} from 'formik';
import {Box} from '@mui/material';
import {getComponentByName} from '../../component_registry';

export const getComponentFromField = (
  uiSpec: any,
  fieldName: string,
  formProps: any,
  handleChangeC: any
) => {
  const fields = uiSpec['fields'];
  const fieldConfig = fields[fieldName];
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  let Component: React.Component;
  try {
    Component = getComponentByName(namespace, name);
  } catch (err) {
    return <>Error</>;
  }
  let value = formProps.values[fieldName];
  if (name === 'MultiSelect' && value === undefined) {
    value = [];
  }

  return (
    <Box key={fieldName}>
      <Field
        component={Component}
        name={fieldName}
        onChange={(e: React.FocusEvent<{name: string}>) => {
          formProps.handleChange(e);
          handleChangeC(e);
        }}
        onBlur={(e: React.FocusEvent<{name: string}>) => {
          formProps.handleChange(e);
          handleChangeC(e);
        }}
        value={value}
        {...fieldConfig['component-parameters']}
        {...fieldConfig['component-parameters']['InputProps']}
        {...fieldConfig['component-parameters']['SelectProps']}
        {...fieldConfig['component-parameters']['InputLabelProps']}
        {...fieldConfig['component-parameters']['FormHelperTextProps']}
      />
    </Box>
  );
};
