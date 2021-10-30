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
import Button, {ButtonProps} from '@material-ui/core/Button';
import { Defaultcomponentsetting,DefaultuiSetting } from './BasicFieldSettings';
export class ActionButton extends React.Component<FieldProps & ButtonProps> {
  clickThis() {
    this.props.form.setFieldValue(this.props.field.name, 'Change!');
  }
  render() {
    return (
      <Button
        variant="outlined"
        color={'primary'}
        {...this.props}
        // Props from the metadata db will overwrite the above
        // style attributes, but not overwrite the below onclick.
        onClick={() => {
          this.clickThis();
        }}
      >
        Action!
      </Button>
    );
  }
}


const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'ActionButton',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'take-action-field',
    id: 'take-action-field',
    helperText: 'Take Action!',
    variant: 'outlined',
  },
  validationSchema: [['yup.string']],
  initialValue: 'hello',
}


const uiSetting = () =>{
  const newuiSetting:any=JSON.parse(JSON.stringify(DefaultuiSetting));
  newuiSetting["viewsets"]= {
    "settings": {
      "views": [
      ],
      "label": "settings"
    },
  }

  return newuiSetting
}

export const ActionSetting =[uiSetting(),uiSpec]

