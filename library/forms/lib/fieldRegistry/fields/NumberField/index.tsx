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
 * Extended props schema for NumberField.
 * Supports both integer and floating-point number types.
 */
const NumberFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Number type: 'integer' uses stepper, 'floating' allows decimals */
  numberType: z.enum(['integer', 'floating']).optional().default('integer'),
});

type NumberFieldProps = z.infer<typeof NumberFieldPropsSchema>;
type NumberFieldFullProps = NumberFieldProps & FormFieldContextProps;

/**
 * Number field component supporting both integer and floating-point input.
 *
 * - Integer mode: Shows stepper controls, parses as integer
 * - Floating mode: Allows decimal input, parses as float
 */
const NumberField: React.FC<NumberFieldFullProps> = props => {
  const {
    state,
    setFieldData,
    handleBlur,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    numberType = 'integer',
  } = props;

  // Value can be number or null
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

    // Parse based on number type
    if (numberType === 'integer') {
      const parsed = parseInt(inputValue, 10);
      if (!isNaN(parsed)) {
        setFieldData(parsed);
      }
    } else {
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        setFieldData(parsed);
      }
    }
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
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
        inputProps={{
          // Step controls decimal precision
          step: numberType === 'integer' ? 1 : 'any',
        }}
      />
    </FieldWrapper>
  );
};

/**
 * Generate a Zod schema for validating the number field value.
 * Uses integer validation for integer type, number for floating.
 */
const valueSchema = (props: NumberFieldProps) => {
  const numberType = props.numberType ?? 'integer';

  let schema;

  if (numberType === 'integer') {
    schema = z.number().int({
      message: 'Please enter a valid whole number',
    });
  } else {
    schema = z.number({
      message: 'Please enter a valid number',
    });
  }

  return schema;
};

/**
 * Field specification for NumberField.
 * Supports both integer (with stepper) and floating-point number input.
 */
export const numberFieldSpec: FieldInfo<NumberFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'NumberField',
  returns: 'faims-core::Number',
  component: NumberField,
  fieldPropsSchema: NumberFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
