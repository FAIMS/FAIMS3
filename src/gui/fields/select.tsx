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
 * Filename: select.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import {MenuItem} from '@material-ui/core';

interface option {
  key: string;
  value: string;
  label: string;
}

interface ElementProps {
  options: Array<option>;
}

interface Props {
  ElementProps: ElementProps;
}

export class Select extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    return (
      <MuiTextField {...fieldToTextField(textFieldProps)} select={true}>
        {children}
        {ElementProps.options.map(option => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
          >
            {option.label}
          </MenuItem>
        ))}
      </MuiTextField>
    );
  }
}
