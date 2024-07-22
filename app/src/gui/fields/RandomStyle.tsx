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
import {Box, Typography} from '@mui/material';

interface Props {
  helperText?: string;
  label?: string;
  variant_style: any;
  html_tag: any;
}

export class RandomStyle extends React.Component<Props> {
  render() {
    return (
      <Box sx={{p: 2, border: '1px dashed grey'}}>
        <Typography variant={this.props.variant_style}>
          {this.props.label}
        </Typography>
        <Typography variant="caption">{this.props.helperText}</Typography>
        <div dangerouslySetInnerHTML={{__html: this.props.html_tag}} />
        <Typography
          paragraph
          sx={{fontWeight: 'fontWeightLight', fontSize: 11}}
        >
          This is a deprecated RandomStyle field, please migrate to RichText.
        </Typography>
      </Box>
    );
  }
}

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'RandomStyle',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     helperText: 'This is sub Title',
//     variant: 'outlined',
//     label: 'Title',
//     variant_style: 'h5',
//     html_tag: '',
//   },
//   validationSchema: [['yup.string']],
//   initialValue: '',
// };
