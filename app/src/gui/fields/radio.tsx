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

import {
  FormControlLabel,
  FormControlLabelProps,
  FormHelperTextProps,
  FormLabelProps,
} from '@mui/material';
import FormControl from '@mui/material/FormControl';
import MuiRadio, {RadioProps} from '@mui/material/Radio';
import MuiRadioGroup from '@mui/material/RadioGroup';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-mui';
import React from 'react';
import FieldWrapper from './fieldWrapper';
import {contentToSanitizedHtml} from '../../utils/DomPurifier';

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
  advancedHelperText?: string; // advanced help text
  ElementProps: ElementProps; // Radio options
  disabled?: boolean; // Wheter the field is disabled
  required?: boolean;
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  /**
   * Handles changes in the selected radio button, allowing users to toggle selection.
   * If a selected radio button is clicked again, it gets deselected (value is cleared).
   *
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e - The change event triggered by user interaction.
   */
  handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const {field, form} = this.props;
    const selectedValue = e.target.value;

    const newValue = field.value === selectedValue ? null : selectedValue;
    form.setFieldValue(field.name, newValue, true);

    form.setTouched({...form.touched, [field.name]: true});
  }

  render() {
    const {
      field,
      form,
      ElementProps,
      label,
      helperText,
      advancedHelperText,
      ...radioGroupProps
    } = this.props;

    return (
      <FieldWrapper
        heading={label}
        subheading={helperText}
        required={this.props.required}
        advancedHelperText={advancedHelperText}
      >
        <FormControl sx={{mb: 4}} error={Boolean(form.errors?.[field.name])}>
          <MuiRadioGroup
            {...fieldToRadioGroup({field, form, ...radioGroupProps})}
            value={field.value || ''}
            onChange={e => this.handleChange(e)}
          >
            {ElementProps.options.map(option => (
              <FormControlLabel
                key={option.key || option.value}
                value={option.value}
                control={
                  <MuiRadio
                    {...option.RadioProps}
                    sx={{
                      alignSelf: 'flex-start',
                      paddingTop: '6px',
                    }}
                  />
                }
                label={
                  <div
                    style={{
                      display: 'block',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      lineHeight: '1.5',
                      paddingTop: '6px',
                      paddingLeft: '0px',
                      marginTop: '0px',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: contentToSanitizedHtml(option.label),
                    }}
                  />
                }
                {...option.FormControlProps}
                disabled={this.props.disabled ?? false}
                sx={{
                  alignItems: 'flex-start',
                  marginBottom: 1,
                  '& .MuiFormControlLabel-label': {
                    display: 'block',
                    marginTop: '0px',
                    alignSelf: 'flex-start',
                    // markdown formatted text will be wrapped in a <p> tag
                    // so we need to remove the default margin
                    // and padding from the <p> tag
                    '& p': {
                      margin: 0,
                      padding: 0,
                    },
                    '& p:first-child': {
                      marginTop: 0,
                    },
                    '& p:last-child': {
                      marginBottom: 0,
                    },
                  },
                }}
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
