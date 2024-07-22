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
  FormLabel,
  FormControlLabel,
  FormHelperText,
  FormLabelProps,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@mui/material';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-mui';
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

interface ElementProps {
  options: Array<option>;
}

interface Props {
  FormLabelProps?: FormLabelProps;
  FormHelperTextProps?: FormHelperTextProps;
  label?: string;
  helperText?: string;
  ElementProps: ElementProps;
  disabled?: boolean;
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  render() {
    const {
      ElementProps,
      FormLabelProps,
      FormHelperTextProps,

      ...radioGroupProps
    } = this.props;

    // for backwards compatibility we check these properties as well as
    // just the plain label and helperText properties
    const label =
      this.props.label || FormLabelProps?.children || this.props.field.name;

    const helperText =
      this.props.helperText || FormHelperTextProps?.children || '';

    let error = false;
    if (
      radioGroupProps.form.errors[radioGroupProps.field.name] &&
      radioGroupProps.form.touched[radioGroupProps.field.name]
    ) {
      error = true;
    }

    // remove helperText from props so we don't pass it into the element
    delete radioGroupProps.helperText;

    return (
      <FormControl error={error}>
        <FormLabel children={label} />
        <MuiRadioGroup {...fieldToRadioGroup(radioGroupProps)}>
          {ElementProps.options.map(option => (
            <FormControlLabel
              key={option.key ? option.key : option.value}
              value={option.value}
              control={<MuiRadio {...option['RadioProps']} />}
              label={option.label}
              {...option['FormControlProps']}
              disabled={this.props.disabled ?? false}
            />
          ))}
        </MuiRadioGroup>
        {error ? (
          <FormHelperText
            children={
              radioGroupProps.form.errors[radioGroupProps.field.name] as string
            }
          />
        ) : (
          <FormHelperText children={helperText} />
        )}
      </FormControl>
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
