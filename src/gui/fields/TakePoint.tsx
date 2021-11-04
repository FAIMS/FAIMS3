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
 * Filename: TakePoint.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button, {ButtonProps} from '@material-ui/core/Button';
import {Plugins} from '@capacitor/core';
import {getDefaultuiSetting } from './BasicFieldSettings';
import {ProjectUIModel} from '../../datamodel/ui'

const {Geolocation} = Plugins;

export class TakePoint extends React.Component<
  FieldProps &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    }
> {
  async takePoint() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      console.debug('Take point coord', coordinates);
      const pos = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
      };
      this.props.form.setFieldValue(this.props.field.name, pos);
    } catch (err: any) {
      console.error(err);
      this.props.form.setFieldError(this.props.field.name, err.message);
    }
  }
  render() {
    const pos = this.props.field.value;
    const error = this.props.form.errors[this.props.field.name];
    let postext = <span>No point taken.</span>;
    if (pos !== null&&pos!== undefined) {
      postext = (
        <span {...this.props['ValueTextProps']}>
          Lat: {pos.latitude}; Long: {pos.longitude}
        </span>
      );
    }
    let error_text = <span {...this.props['NoErrorTextProps']}></span>;
    if (error) {
      error_text = <span {...this.props['ErrorTextProps']}>{error}</span>;
    }
    return (
      <div>
        <Button
          variant="outlined"
          color={'primary'}
          style={{marginRight: '10px'}}
          {...this.props}
          // Props from the metadata db will overwrite the above
          // style attributes, but not overwrite the below onclick.
          onClick={async () => {
            await this.takePoint();
          }}
        >
          Take Point
        </Button>
        {postext}
        {error_text}
      </div>
    );
  }
}


const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'TakePoint',
  'type-returned': 'faims-pos::Location', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'take-point-field',
    id: 'take-point-field',
    helperText: 'Get position',
    variant: 'outlined',
  },
  validationSchema: [
    ['yup.object'],
    ['yup.nullable'],
    [
      'yup.shape',
      {
        latitude: [['yup.number'], ['yup.required']],
        longitude: [['yup.number'], ['yup.required']],
      },
    ],
  ],
  initialValue: null,
}


const uiSetting = () =>{
  const newuiSetting:ProjectUIModel=getDefaultuiSetting();
  newuiSetting["viewsets"]= {
    "settings": {
      "views": [
      ],
      "label": "settings"
    },
  }

  return newuiSetting
}
  

export const TakePointSetting =[uiSetting(),uiSpec]

