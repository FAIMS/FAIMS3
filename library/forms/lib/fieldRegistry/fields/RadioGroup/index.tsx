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
 * RadioGroup Component
 *
 * This component renders a group of radio buttons using Material-UI.
 * It integrates with the form system for managing state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - Toggle behavior: clicking a selected radio deselects it.
 * - Rich text labels: option labels support sanitized HTML content.
 * - "Other" option: allows users to enter custom text beyond predefined choices.
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the radio options array and enableOtherOption flag.
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import {FormControlLabel, TextField} from '@mui/material';
import FormControl from '@mui/material/FormControl';
import MuiRadio from '@mui/material/Radio';
import MuiRadioGroup from '@mui/material/RadioGroup';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import {contentToSanitizedHtml} from '../RichText/DomPurifier';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  OTHER_MARKER,
  OTHER_PREFIX,
  otherTextFieldSx,
  useOtherOption,
} from '../../../hooks/useOtherOption';

// ============================================================================
// Types & Schema
// ============================================================================

const RadioOptionSchema = z.object({
  key: z.string().optional(),
  value: z.string(),
  label: z.string(),
});

const RadioGroupFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    options: z.array(RadioOptionSchema),
    enableOtherOption: z.boolean().optional(),
  }),
});

type RadioGroupFieldProps = z.infer<typeof RadioGroupFieldPropsSchema>;
type RadioOption = z.infer<typeof RadioOptionSchema>;
type FieldProps = RadioGroupFieldProps & FullFieldProps;

// ============================================================================
// Main Component
// ============================================================================

/**
 * RadioGroup Component - A reusable radio button group with form integration.
 * Supports toggle behavior where clicking a selected option deselects it.
 * Supports "Other" option for custom text entry.
 */
export const RadioGroup = (props: FieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    handleBlur,
    ElementProps,
  } = props;

  const rawValue = (state.value?.data as string) ?? '';
  const enableOtherOption = ElementProps.enableOtherOption ?? false;
  const predefinedValues = ElementProps.options.map(opt => opt.value);

  const {setOtherSelected, hasOtherSelected, otherText, handleOtherTextChange} =
    useOtherOption({
      enableOtherOption,
      rawValue,
      predefinedValues,
      setFieldData,
    });

  const displayValue = hasOtherSelected
    ? OTHER_MARKER
    : predefinedValues.includes(rawValue)
      ? rawValue
      : '';

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedValue = event.target.value;

    if (selectedValue === OTHER_MARKER) {
      if (hasOtherSelected) {
        setOtherSelected(false);
        setFieldData('');
      } else {
        // Store empty "Other: " so Zod can validate it
        setOtherSelected(true);
        setFieldData(OTHER_PREFIX);
      }
    } else {
      setOtherSelected(false);
      const newValue = displayValue === selectedValue ? '' : selectedValue;
      setFieldData(newValue);
    }
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <FormControl>
        <MuiRadioGroup
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          {ElementProps.options.map((option: RadioOption) => (
            <FormControlLabel
              key={option.key || option.value}
              value={option.value}
              control={
                <MuiRadio
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
              disabled={disabled}
              sx={{
                alignItems: 'flex-start',
                marginBottom: 1,
                '& .MuiFormControlLabel-label': {
                  display: 'block',
                  marginTop: '0px',
                  alignSelf: 'flex-start',
                  '& p': {
                    margin: 0,
                    padding: 0,
                  },
                  '& p:first-of-type': {
                    marginTop: 0,
                  },
                  '& p:last-of-type': {
                    marginBottom: 0,
                  },
                },
              }}
            />
          ))}

          {/* "Other" option with text field */}
          {enableOtherOption && (
            <FormControlLabel
              value={OTHER_MARKER}
              control={
                <MuiRadio
                  sx={{
                    alignSelf: 'flex-start',
                    paddingTop: '6px',
                  }}
                />
              }
              label={
                <TextField
                  size="small"
                  placeholder="Other"
                  value={otherText}
                  onChange={e => {
                    if (!hasOtherSelected && e.target.value.length > 0) {
                      setOtherSelected(true);
                    }
                    handleOtherTextChange(e.target.value);
                  }}
                  onFocus={() => {
                    if (!hasOtherSelected) {
                      setOtherSelected(true);
                    }
                  }}
                  onBlur={handleBlur}
                  disabled={disabled}
                  variant="standard"
                  multiline
                  sx={{
                    minWidth: '200px',
                    marginTop: '2px',
                    ...otherTextFieldSx,
                  }}
                />
              }
              disabled={disabled}
              sx={{
                alignItems: 'flex-start',
                marginBottom: 1,
                '& .MuiFormControlLabel-label': {
                  display: 'block',
                  marginTop: '0px',
                  alignSelf: 'flex-start',
                },
              }}
            />
          )}
        </MuiRadioGroup>
      </FormControl>
    </FieldWrapper>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

const valueSchema = (props: RadioGroupFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  const enableOtherOption = props.ElementProps.enableOtherOption ?? false;

  // Handle edge case of no options defined
  if (optionValues.length === 0) {
    if (props.required) {
      return z.string().min(1, {message: 'Please select an option'});
    }
    return z.union([z.string(), z.null()]);
  }

  const optionsSchema = z.enum(optionValues as [string, ...string[]]);

  if (enableOtherOption) {
    const baseSchema = z.string();

    if (props.required) {
      // add ed  a check to  must have a value AND if "Other" is selected, must have text
      return baseSchema.min(1, {message: 'Please select an option'}).refine(
        value => {
          if (optionValues.includes(value)) return true;
          if (value.startsWith(OTHER_PREFIX)) {
            return value.slice(OTHER_PREFIX.length).trim().length > 0;
          }
          return false;
        },
        {
          message:
            'Please enter text for the "Other" option or select a different option',
        }
      );
    }

    return baseSchema.refine(
      value => {
        if (value === '') return true;
        if (optionValues.includes(value)) return true;
        if (value.startsWith(OTHER_PREFIX)) {
          return value.slice(OTHER_PREFIX.length).trim().length > 0;
        }
        return false;
      },
      {
        message:
          'Please enter text for the "Other" option or select a different option',
      }
    );
  }

  if (props.required) {
    return optionsSchema;
  }

  return z.union([optionsSchema, z.null(), z.literal('')]);
};

// ============================================================================
// Field Registration
// ============================================================================

export const radioGroupFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'RadioGroup',
  returns: 'faims-core::String',
  component: RadioGroup,
  fieldPropsSchema: RadioGroupFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
