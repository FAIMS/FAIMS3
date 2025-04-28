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
 * - Support for "Other" option with custom text input
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the dropdown options and other option settings.
 * - field (object): Formik field object for managing value.
 * - required : To visually show if the field is required.
 * - form (object): Formik form object for managing state and validation.
 */
import {ElementOption} from '@faims3/data-model';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Select as MuiSelect,
  OutlinedInput,
  Stack,
  TextField,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {FieldProps} from 'formik';
import {TextFieldProps} from 'formik-mui';
import React, {ReactNode, useState} from 'react';
import FieldWrapper from './fieldWrapper';

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
  advancedHelperText?: ReactNode;
}

/**
 * Select Component - A reusable dropdown select field with Formik integration.
 * Now includes support for an "Other" option with custom text input.
 */
export const Select = (props: FieldProps & Props & TextFieldProps) => {
  const theme = useTheme();

  // Check if the current value is not in the option list - could be an "other" value
  const unknownValue =
    props.field.value &&
    !props.ElementProps.options.some(o => o.value === props.field.value)
      ? props.field.value
      : undefined;

  const hasOtherValue =
    props.ElementProps.otherOption?.enabled && !!unknownValue;
  const otherValue = hasOtherValue ? unknownValue : '';

  // State for the other input field
  const [otherIsSelected, setOtherIsSelected] = useState<boolean>(!!otherValue);

  /**
   * Handles the change event when a dropdown option is selected.
   */
  const handleChange = (event: any) => {
    const selectedValue = event.target.value;
    setOtherIsSelected(false);
    props.form.setFieldValue(props.field.name, selectedValue, true);
  };

  /**
   * Handles when the user enters a custom "other" value
   */
  const handleOtherChange = (otherValue: string | undefined) => {
    if (!otherValue) {
      props.form.setFieldValue(props.field.name, '', true);
    } else {
      props.form.setFieldValue(props.field.name, otherValue, true);
    }
  };

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <Stack spacing={2}>
        <FormControl
          sx={{
            width: '100%',
            backgroundColor: theme.palette.background.default,
            '& .MuiSelect-select': {
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              padding: '12px',
            },
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

        {props.ElementProps.otherOption?.enabled && (
          <>
            <FormControlLabel
              key={props.ElementProps.otherOption.label}
              control={
                <Checkbox
                  checked={otherIsSelected}
                  onChange={() => {
                    if (otherIsSelected) {
                      // we are unchecking
                      handleOtherChange(undefined);
                      setOtherIsSelected(false);
                    } else {
                      // we are checking
                      setOtherIsSelected(true);
                    }
                  }}
                  sx={{
                    padding: '4px 8px 0 0',
                    alignSelf: 'flex-start',
                  }}
                />
              }
              label={
                <Box
                  component="span"
                  sx={{
                    display: 'contents',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '1.8rem',
                    paddingTop: '4px',
                  }}
                >
                  {props.ElementProps.otherOption.label}
                </Box>
              }
              sx={{
                alignItems: 'center',
                mb: 1.5,
                m: 0, // reset default margins
                '& .MuiFormControlLabel-label': {
                  marginTop: 0,
                },
              }}
            />
            {otherIsSelected && (
              <TextField
                value={otherValue}
                placeholder={'Enter other value...'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  handleOtherChange(event.target.value);
                }}
                sx={{
                  padding: '4px 8px 0 0',
                  alignSelf: 'flex-start',
                }}
              />
            )}
          </>
        )}
      </Stack>
    </FieldWrapper>
  );
};

/*
Example UI spec for this select component:
{
  'component-namespace': 'faims-custom',
  'component-name': 'Select',
  'type-returned': 'faims-core::String',
  'component-parameters': {
    fullWidth: true,
    helperText: 'Choose an option from the dropdown',
    variant: 'outlined',
    required: false,
    select: true,
    InputProps: {},
    SelectProps: {},
    ElementProps: {
      options: [
        {
          value: 'Option1',
          label: 'Option 1',
        },
        {
          value: 'Option2',
          label: 'Option 2',
        }
      ],
      otherOption: {
        label: 'Other (please specify)',
        enabled: true
      }
    },
    InputLabelProps: {
      label: 'Select Field',
    },
  },
  validationSchema: [['yup.string']],
  initialValue: '',
};
*/
