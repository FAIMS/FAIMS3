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
 * Checkbox Component
 *
 * This component renders a checkbox field using Material-UI.
 * It integrates with the form system for managing state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - Error display for validation feedback.
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import {FormControlLabel, FormHelperText} from '@mui/material';
import MuiCheckbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Types & Schema
// ============================================================================

const CheckboxFieldPropsSchema = BaseFieldPropsSchema.extend({});

type CheckboxFieldProps = z.infer<typeof CheckboxFieldPropsSchema>;
type FieldProps = CheckboxFieldProps & FullFieldProps;

// ============================================================================
// Main Component
// ============================================================================

/**
 * Checkbox Component - A reusable checkbox field with form integration.
 */
export const Checkbox = (props: FieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    handleBlur,
  } = props;

  const checked = (state.value?.data as boolean) ?? false;
  // TODO errors
  const error = undefined;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFieldData(event.target.checked);
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <FormControl error={!!error}>
        <FormControlLabel
          control={
            <MuiCheckbox
              checked={checked}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled}
            />
          }
          label="" // label shown via FieldWrapper
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    </FieldWrapper>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

/**
 * Generate a zod schema for the value.
 * The value is a boolean representing the checked state.
 */
const valueSchema = () => {
  return z.boolean();
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Export a constant with the information required to register this field type
 */
export const checkboxFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'Checkbox',
  returns: 'faims-core::Bool',
  component: Checkbox,
  fieldSchema: CheckboxFieldPropsSchema,
  valueSchemaFunction: valueSchema,
};
