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
 * Filename: checkbox.tsx
 * Description: 
 *   TODO
 */
 
import React from 'react';
import MuiCheckbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import {
  FormControlLabel,
  FormHelperText,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@material-ui/core';
import {fieldToCheckbox, CheckboxProps} from 'formik-material-ui';

interface Props {
  FormControlLabelProps: FormControlLabelProps;
  FormHelperTextProps: FormHelperTextProps;
}

export class Checkbox extends React.Component<CheckboxProps & Props> {
  render() {
    const {
      FormControlLabelProps,
      FormHelperTextProps,
      ...checkboxWithLabelProps
    } = this.props;

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
          {...FormControlLabelProps}
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
              ]
            }
          />
        ) : (
          <FormHelperText {...FormHelperTextProps} />
        )}
      </FormControl>
    );
  }
}
