/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License"); you may not
 * use, this file except in compliance with the License. You may obtain a copy
 * of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND either express or implied. See, the
 * License, for the specific language governing permissions and limitations
 * under the License.
 *
 * Filename: TemplatedStringField.tsx Description: A field that constructs a
 * value via a template from other field values
 *
 * NOTE: this is now just a stale text field which is read only - templated
 * field values are now managed through the form.tsx render loop and implemented
 * universally in formUtilities.ts
 */

import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {TextFieldProps} from 'formik-mui';

interface Props {
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

  render() {
    return (
      <>
        <MuiTextField
          value={this.props.value}
          id={this.props.id}
          label={this.props.label}
          disabled={true}
          variant="outlined"
          inputProps={{readOnly: true}}
          fullWidth
        ></MuiTextField>
      </>
    );
  }
}
