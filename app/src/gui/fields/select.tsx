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
 /*
 * Select Component
 *
 * This component renders a dropdown select field using Material-UI.
 * It integrates with Formik for managing form state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - A Material-UI dropdown select.
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the dropdown options.
 * - field (object): Formik field object for managing value.
 * - reqired : To visually showif the field is required if it is.
 * - form (object): Formik form object for managing state and validation.
 */
import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-mui';
import {
  FormControl,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select as MuiSelect,
} from '@mui/material';
import {ElementOption} from '@faims3/data-model';

/**
 * Defines the properties for the dropdown options.
 */
interface ElementProps {
  options: Array<ElementOption>;
  // This will always be included for new notebooks - but is also backwards
  // compatible by not asserting it exists
  otherOption?: {label?: string; enabled?: boolean};
}

/**
 * Props for the Select component.
 */
interface Props {
  ElementProps: ElementProps;
  select_others?: string;
  advancedHelperText?: string;
}

import {useTheme} from '@mui/material/styles';
import FieldWrapper from './fieldWrapper';

/**
 * Select Component - A reusable dropdown select field with Formik integration.
 */
export const Select = (props: Props & TextFieldProps) => {
  const theme = useTheme();

  /**
   * Handles the change event when a new option is selected.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event.
   */
  const handleChange = (e: any) => {
    props.form.setFieldValue(props.field.name, e.target.value, true);
  };

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <FormControl
        sx={{
          width: '100%',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <MuiSelect
          onChange={handleChange}
          value={props.field.value}
          input={<OutlinedInput />}
        >
          {props.ElementProps.options.map((option: any) => (
            <MenuItem
              key={option.key ? option.key : option.value}
              value={option.value}
              sx={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
              }}
            >
              <ListItemText primary={option.label} />
            </MenuItem>
          ))}
        </MuiSelect>
      </FormControl>
    </FieldWrapper>
  );
};

export class Selectx extends React.Component<TextFieldProps & Props> {
  handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    this.props.form.setFieldValue(this.props.field.name, e.target.value, true);
  }

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
          onChange={e => this.handleChange(e)}
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
