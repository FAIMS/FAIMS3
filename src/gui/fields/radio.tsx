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
 * Filename: radio.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiRadioGroup from '@material-ui/core/RadioGroup';
import MuiRadio from '@material-ui/core/Radio';
import FormControl from '@material-ui/core/FormControl';
import {
  FormLabel,
  FormControlLabel,
  FormHelperText,
  FormLabelProps,
  FormHelperTextProps,
} from '@material-ui/core';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-material-ui';

interface option {
  key: string;
  value: string;
  label: string;
}

interface ElementProps {
  options: Array<option>;
}

interface Props {
  FormLabelProps: FormLabelProps;
  FormHelperTextProps: FormHelperTextProps;
  ElementProps: ElementProps;
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  render() {
    const {
      ElementProps,
      FormLabelProps,
      FormHelperTextProps,

      ...radioGroupProps
    } = this.props;

    let error = false;
    if (
      radioGroupProps.form.errors[radioGroupProps.field.name] &&
      radioGroupProps.form.touched[radioGroupProps.field.name]
    ) {
      error = true;
    }

    return (
      <FormControl error={error}>
        <FormLabel {...FormLabelProps} />
        <MuiRadioGroup {...fieldToRadioGroup(radioGroupProps)}>
          {ElementProps.options.map(option => (
            <FormControlLabel
              key={option.key ? option.key : option.value}
              value={option.value}
              control={<MuiRadio />}
              label={option.label}
            />
          ))}
        </MuiRadioGroup>
        {error ? (
          <FormHelperText
            children={radioGroupProps.form.errors[radioGroupProps.field.name]}
          />
        ) : (
          <FormHelperText {...FormHelperTextProps} />
        )}
      </FormControl>
    );
  }
}
