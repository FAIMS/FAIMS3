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
 * Filename: TemplatedStringField.tsx
 * Description:
 *   A field that constructs a value via a template from other field values
 */

import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {TextFieldProps} from 'formik-mui';
import Mustache from 'mustache';
import getLocalDate from './LocalDate';

interface FieldValues {
  [field_name: string]: any;
}

function render_template(template: string, values: FieldValues): string {
  return Mustache.render(template, values);
}

interface Props {
  template: string;
  disabled?: boolean;
  value?: string;
}

interface State {
  value: string;
}

export class TemplatedStringField extends React.Component<
  TextFieldProps & Props,
  State
> {
  constructor(props: TextFieldProps & Props) {
    super(props);
    this.state = {
      value: '',
    };
  }

  componentDidUpdate() {
    if (this.props.disabled === true) return;
    const {template, ...textFieldProps} = this.props;

    const field_values: FieldValues = {};
    for (const field_name in textFieldProps.form.values) {
      if (field_name !== textFieldProps.field.name) {
        let value = textFieldProps.form.values[field_name];
        if (typeof value === 'function')
          value = getLocalDate(value).replace('T', ' ');
        field_values[field_name] = value;
      }
    }
    const value = render_template(template, field_values);
    if (value !== this.state.value) {
      this.setState({value: value});
      this.props.form.setFieldValue(this.props.field.name, value);
      if (value !== '')
        if (this.props.form.errors[this.props.field.name] !== undefined)
          this.props.form.setFieldError(this.props.field.name, undefined);
    }
  }

  render() {
    return (
      <>
        <MuiTextField
          value={this.props.value}
          id={this.props.id}
          label={this.props.label}
          variant="outlined"
          inputProps={{readOnly: true}}
          fullWidth
        ></MuiTextField>
      </>
    );
  }
}
