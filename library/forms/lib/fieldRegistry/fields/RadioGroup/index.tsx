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
  otherTextFieldSx,
  useOtherOption,
} from '../hooks/useOtherOption';

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

  const {
    setOtherSelected,
    setOtherFieldTouched,
    hasOtherSelected,
    otherText,
    otherFieldError,
    handleOtherTextChange,
  } = useOtherOption({
    enableOtherOption,
    rawValue,
    predefinedValues,
    setFieldData,
    emptyErrorMessage:
      'Please enter text for the "Other" option or unselect it',
  });

  const displayValue = hasOtherSelected
    ? OTHER_MARKER
    : predefinedValues.includes(rawValue)
    ? rawValue
    : '';

  const formErrors = props.state.meta.errors as unknown as string[];
  const allErrors = otherFieldError
    ? [...(formErrors || []), otherFieldError]
    : formErrors;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedValue = event.target.value;

    if (selectedValue === OTHER_MARKER) {
      if (hasOtherSelected) {
        // Toggle off - deselect "Other"
        setOtherSelected(false);
        setFieldData('');
      } else {
        // Select "Other" - use empty string, text will be added via the hook
        setOtherSelected(true);
        setFieldData('');
      }
    } else {
      // Selecting a predefined option (or toggling it off)
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
      errors={allErrors}
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
                  // markdown formatted text will be wrapped in a <p> tag
                  // so we need to remove the default margin
                  // and padding from the <p> tag
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
                    // Auto-select "Other" radio when user starts typing
                    if (!hasOtherSelected && e.target.value.length > 0) {
                      setOtherSelected(true);
                    }
                    handleOtherTextChange(e.target.value);
                  }}
                  onFocus={() => {
                    // Auto-select "Other" radio when field is focused
                    if (!hasOtherSelected) {
                      setOtherSelected(true);
                    }
                  }}
                  onBlur={() => {
                    handleBlur();
                    setOtherFieldTouched(true);
                  }}
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

  // When "Other" is enabled, allow any string (including "Other: xxx" values)
  if (enableOtherOption) {
    if (props.required) {
      return z.string().min(1, {message: 'Please select an option'});
    }
    return z.string();
  }

  if (props.required) {
    return optionsSchema;
  }

  // Optional: allow null or empty string for no selection
  return z.union([optionsSchema, z.null(), z.literal('')]);
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Export a constant with the information required to register this field type
 */
export const radioGroupFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'RadioGroup',
  returns: 'faims-core::String',
  component: RadioGroup,
  fieldPropsSchema: RadioGroupFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
