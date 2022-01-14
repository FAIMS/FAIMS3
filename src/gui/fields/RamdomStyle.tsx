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
 * Filename: RandomStyle.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {getDefaultuiSetting} from './BasicFieldSettings';
import {ProjectUIModel} from '../../datamodel/ui';
import { Typography } from '@material-ui/core';

interface Props {
  helperText?:string;
  label?:string;
  variant_style:any;
  html_tag:any;
}

export class RandomStyle extends React.Component<Props > {

  render() {
    return (
      <div>
      <Typography variant={this.props.variant_style}>{this.props.label}</Typography>
      <Typography variant='caption'>{this.props.helperText}</Typography>
      <div dangerouslySetInnerHTML={{__html: this.props.html_tag}} />
      </div>
    );
  }
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'RandomStyle',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'This is sub Title',
    variant: 'outlined',
    label:'Core 1',
    variant_style: 'h5',
    html_tag:'',
  },
  validationSchema: [['yup.string']],
  initialValue: '',
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['fields']['variant_style'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: 'h1',
            label: 'Title 1',
          },
          {
            value: 'h2',
            label: 'Title 2',
          },
          {
            value: 'h3',
            label: 'Title 3',
          },
          {
            value: 'h4',
            label: 'Title 4',
          },
          {
            value: 'h5',
            label: 'Title 5',
          },
          {
            value: 'subtitle1',
            label: 'subtitle1',
          },
          {
            value: 'subtitle2',
            label: 'subtitle2',
          },
          {
            value: 'body1',
            label: 'body',
          },
          {
            value: 'caption',
            label: 'caption',
          },
        ],
      },
      InputLabelProps: {
        label: 'Select Style of Title',
      },
    },
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: 'faims-core::Child',
  };
  newuiSetting['fields']['html_tag']= {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      variant: 'outlined',
      required: false,
      fullWidth: true,
      helperText: 'if you want html tag ONLY, leave the label empty and input the html tag',
      InputLabelProps: {
        label: 'html_tag',
      },
      type: 'text',
    },
    alert: false,
    validationSchema: [['yup.string']],
    initialValue: '',
  }

  newuiSetting['views']['FormParamater']['fields'] = [
    'label',
    'helperText',
    'variant_style',
    'html_tag'
  ];
  newuiSetting['viewsets'] = {
    settings: {
      views: ['FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export const RandomStyleSetting = [uiSetting(), uiSpec];
