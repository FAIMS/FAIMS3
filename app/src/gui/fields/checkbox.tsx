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
 * Filename: checkbox.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiCheckbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import {
  FormControlLabel,
  FormHelperText,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@mui/material';
import {fieldToCheckbox, CheckboxProps} from 'formik-mui';

interface Props {
  FormControlLabelProps?: FormControlLabelProps; // deprecated
  FormHelperTextProps?: FormHelperTextProps; // deprecated
  helperText?: string;
  label?: string;
}

export class Checkbox extends React.Component<CheckboxProps & Props> {
  render() {
    const {
      FormControlLabelProps,
      FormHelperTextProps,
      helperText,
      ...checkboxWithLabelProps
    } = this.props;

    // for backwards compatibility we check these properties as well as
    // just the plain label and helperText properties
    const label =
      this.props.label || FormControlLabelProps?.label || this.props.field.name;

    const theHelperText = helperText || FormHelperTextProps?.children || '';

    let error = false;
    if (
      checkboxWithLabelProps.form.errors[checkboxWithLabelProps.field.name] &&
      checkboxWithLabelProps.form.touched[checkboxWithLabelProps.field.name]
    ) {
      error = true;
    }

    return (
      <FormControl error={error}>
        <FormControlLabel
          label={label}
          control={
            <MuiCheckbox
              {...fieldToCheckbox(checkboxWithLabelProps)}
              checked={checkboxWithLabelProps.field.value}
            />
          }
        />
        {error ? (
          <FormHelperText
            children={
              checkboxWithLabelProps.form.errors[
                checkboxWithLabelProps.field.name
              ] as string
            }
          />
        ) : (
          <FormHelperText children={theHelperText} />
        )}
      </FormControl>
    );
  }
}

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'Checkbox',
//   'type-returned': 'faims-core::Bool', // matches a type in the Project Model
//   'component-parameters': {
//     name: 'checkbox-field',
//     id: 'checkbox-field',
//     required: false,
//     type: 'checkbox',
//     label: 'Terms and Conditions',
//     helperText: 'Read the terms and conditions carefully.',

//     // Label: {label: 'Terms and Conditions'},
//   },
//   validationSchema: [
//     ['yup.bool'],
//     // ['yup.oneOf', [true], ''],
//   ],
//   initialValue: false,
// };
