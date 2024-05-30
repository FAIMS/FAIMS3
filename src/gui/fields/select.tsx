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

// import TextField from '@mui/material/TextField';
/* eslint-disable @typescript-eslint/no-unused-vars */
// interface option {
//   key: string;
//   value: string;
//   label: string;
// }

interface ElementProps {
  options: Array<ElementOption>;
}

interface Props {
  ElementProps: ElementProps;
  select_others?: string;
}

export class Select extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    /***make select not multiple to avoid error */
    // ensure we have a valid default value to avoid warnings
    if (textFieldProps.defaultValue === undefined) {
      textFieldProps.defaultValue = '';
    }
    return (
      <>
        <MuiTextField
          {...fieldToTextField(textFieldProps)}
          select={true}
          SelectProps={{
            multiple: false,
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
        {/* {this.props.form.values[this.props.field.name].includes('Others')&&this.props.select_others==='otherswith'&&
      <TextField
      label='Others'
      id={this.props.field.name+'others'}
      variant="outlined"
      onChange={(event: any) => {
        this.props.form.setFieldValue(this.props.field.name+'others', event.target.value);

      }}
      />
      }*/}
      </>
    );
  }
}

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'Select',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     helperText: 'Choose a field from the dropdown',
//     variant: 'outlined',
//     required: false,
//     select: true,
//     InputProps: {},
//     SelectProps: {},
//     ElementProps: {
//       options: [],
//     },
//     // select_others:'otherswith',
//     InputLabelProps: {
//       label: 'Select Field',
//     },
//   },
//   validationSchema: [['yup.string']],
//   initialValue: '',
// };
