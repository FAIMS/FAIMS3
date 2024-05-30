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
 * Filename: select.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-mui';
import {MenuItem} from '@mui/material';
import {ElementOption} from 'faims3-datamodel';

interface ElementProps {
  options: Array<ElementOption>;
}

interface Props {
  ElementProps: ElementProps;
  select_others?: string;
}

export class MultiSelect extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    return (
      <>
        <MuiTextField
          {...fieldToTextField(textFieldProps)}
          select={true}
          SelectProps={{
            multiple: true,
          }}
        >
          {children}
          {ElementProps.options.map((option: any) => (
            <MenuItem
              key={option.key ? option.key : option.value}
              value={option.value}
            >
              {option.label}
            </MenuItem>
          ))}
        </MuiTextField>
      </>
    );
  }
}

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'MultiSelect',
//   'type-returned': 'faims-core::Array', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     helperText: 'Choose items from the dropdown',
//     variant: 'outlined',
//     required: false,
//     select: true,
//     InputProps: {},
//     SelectProps: {
//       multiple: true,
//     },
//     ElementProps: {
//       options: [
//         {
//           value: 'Default',
//           label: 'Default',
//         },
//         {
//           value: 'Default2',
//           label: 'Default2',
//         },
//       ],
//     },
//     InputLabelProps: {
//       label: 'Select Multiple',
//     },
//   },
//   validationSchema: [['yup.array']],
//   initialValue: [],
// };
