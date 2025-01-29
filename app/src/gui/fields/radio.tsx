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
 * Filename: radio.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiRadioGroup from '@mui/material/RadioGroup';
import MuiRadio, {RadioProps} from '@mui/material/Radio';
import FormControl from '@mui/material/FormControl';
import {
  FormControlLabel,
  FormLabelProps,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@mui/material';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-mui';
import FieldWrapper from './fieldWrapper';
/**
 * Represents a single option in the radio group.
 */
interface option {
  key?: string;
  value: string;
  label: string;
  FormControlProps?: Omit<
    FormControlLabelProps,
    'control' | 'value' | 'key' | 'label'
  >;
  RadioProps: RadioProps;
}

/**
 * Defines the structure of the options array for the RadioGroup component.
 */
interface ElementProps {
  options: Array<option>;
}

/**
 * Props for the RadioGroup component.
 */
interface Props {
  FormLabelProps?: FormLabelProps;
  FormHelperTextProps?: FormHelperTextProps;
  label?: string; // Heading
  helperText?: string; // Subheading
  ElementProps: ElementProps; // Radio options
  disabled?: boolean; // Wheter the field is disabled
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  /**
   * Handles changes in the selected radio button.
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e - The change event.
   */
  handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    this.props.form.setFieldValue(this.props.field.name, e.target.value, true);
  }

  render() {
    const {ElementProps, label, helperText, ...radioGroupProps} = this.props;

    return (
      <FieldWrapper heading={label} subheading={helperText}>
        <FormControl
          error={Boolean(
            radioGroupProps.form.errors[radioGroupProps.field.name]
          )}
        >
          <MuiRadioGroup
            {...fieldToRadioGroup(radioGroupProps)}
            onChange={e => this.handleChange(e)}
          >
            {ElementProps.options.map(option => (
              <FormControlLabel
                key={option.key || option.value}
                value={option.value}
                control={<MuiRadio {...option.RadioProps} />}
                label={option.label}
                {...option.FormControlProps}
                disabled={this.props.disabled ?? false}
              />
            ))}
          </MuiRadioGroup>
        </FormControl>
      </FieldWrapper>
    );
  }
}
// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'RadioGroup',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     name: 'radio-group-field',
//     id: 'radio-group-field',
//     variant: 'outlined',
//     required: false,
//     ElementProps: {
//       options: [
//         {
//           value: '1',
//           label: '1',
//           RadioProps: {
//             id: 'radio-group-field-1',
//           },
//         },
//       ],
//     },
//     FormLabelProps: {
//       children: 'Pick a number',
//     },
//     FormHelperTextProps: {
//       children: 'Make sure you choose the right one!',
//     },
//   },
//   validationSchema: [['yup.string']],
//   initialValue: '1',
// };
