import {TextField as MuiTextField} from '@mui/material';
import React from 'react';
import z from 'zod';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

/**
 * Extended props schema for ControlledNumber.
 * Includes min/max constraints for validation.
 */
const ControlledNumberPropsSchema = BaseFieldPropsSchema.extend({
  /** Minimum allowed value (inclusive) */
  min: z.number().optional(),
  /** Maximum allowed value (inclusive) */
  max: z.number().optional(),
});

type ControlledNumberProps = z.infer<typeof ControlledNumberPropsSchema>;
type ControlledNumberFullProps = ControlledNumberProps & FormFieldContextProps;

/**
 * Controlled number field with min/max validation.
 * Accepts integer values within a configurable range.
 */
const ControlledNumber: React.FC<ControlledNumberFullProps> = props => {
  const {
    state,
    setFieldData,
    handleBlur,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    min,
    max,
  } = props;

  // Value can be number, empty string, or null
  const rawValue = state.value?.data;
  const value = rawValue === null || rawValue === undefined ? '' : rawValue;
  const errors = state.meta.errors as unknown as string[];

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;

    // Allow empty string for clearing the field
    if (inputValue === '') {
      setFieldData(null);
      return;
    }

    // Parse as integer
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      setFieldData(parsed);
    }
  };

  // Build helper text with range info
  const rangeHint = buildRangeHint(min, max);
  const fullHelperText = [helperText, rangeHint].filter(Boolean).join(' ');

  return (
    <FieldWrapper
      heading={label}
      subheading={fullHelperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <MuiTextField
        value={value}
        fullWidth
        onChange={onChange}
        onBlur={handleBlur}
        variant="outlined"
        disabled={disabled}
        type="number"
        inputProps={{min, max}}
      />
    </FieldWrapper>
  );
};

/**
 * Build a human-readable range hint string.
 */
function buildRangeHint(
  min: number | undefined,
  max: number | undefined
): string {
  if (min !== undefined && max !== undefined) {
    return `(${min} to ${max})`;
  }
  if (min !== undefined) {
    return `(min: ${min})`;
  }
  if (max !== undefined) {
    return `(max: ${max})`;
  }
  return '';
}

/**
 * Generate a Zod schema for validating the controlled number value.
 * Includes min/max constraints and required validation.
 */
const valueSchema = (props: ControlledNumberProps) => {
  let schema = z.number({
    message: 'Please enter a valid number',
  });

  if (props.min !== undefined) {
    schema = schema.min(props.min, {
      message: `Must be ${props.min} or more`,
    });
  }

  if (props.max !== undefined) {
    schema = schema.max(props.max, {
      message: `Must be ${props.max} or less`,
    });
  }

  return schema;
};

/**
 * Field specification for ControlledNumber.
 * Numeric input with configurable min/max validation.
 *
 * This replaces the legacy formik-material-ui::TextField with number type
 * and min/max validation.
 */
export const controlledNumberFieldSpec: FieldInfo<ControlledNumberFullProps> = {
  namespace: 'faims-custom',
  name: 'ControlledNumber',
  returns: 'faims-core::Integer',
  component: ControlledNumber,
  fieldPropsSchema: ControlledNumberPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
