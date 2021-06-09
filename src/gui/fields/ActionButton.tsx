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
 * Filename: ActionButton.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button from '@material-ui/core/Button';

export class ActionButton extends React.Component<FieldProps> {
  clickThis() {
    this.props.form.setFieldValue(this.props.field.name, 'Change!');
  }
  render() {
    return (
      <Button
        variant="outlined"
        color={'primary'}
        onClick={() => {
          this.clickThis();
        }}
      >
        Action!
      </Button>
    );
  }
}
