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
 * Filename: TemplatedStringField.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import Mustache from 'mustache';

interface FieldValues {
  [field_name: string]: any;
}

function render_template(template: string, values: FieldValues): string {
  return Mustache.render(template, values);
}

interface Props {
  template: string;
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

  render() {
    const {template, children, ...textFieldProps} = this.props;

    const field_values: FieldValues = {};
    for (const field_name in textFieldProps.form.values) {
      if (field_name !== textFieldProps.field.name) {
        field_values[field_name] = textFieldProps.form.values[field_name];
      }
    }

    const text_props = fieldToTextField(textFieldProps);
    if (text_props.InputProps === undefined) {
      text_props.InputProps = {};
    }
    text_props.InputProps.readOnly = true;
    const value = render_template(template, field_values);
    if (value !== this.state.value) {
      this.setState({value: value});
      this.props.form.setFieldValue(this.props.field.name, value);
    }

    return <MuiTextField {...text_props}>{children}</MuiTextField>;
  }
}
