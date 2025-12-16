/**
 * DateTime Fields
 *
 * Provides date and time input fields using native HTML input types.
 * Exports separate field specs for:
 * - DateTimePicker (datetime-local)
 * - DatePicker (date)
 * - MonthPicker (month)
 */

import React, {HTMLInputTypeAttribute} from 'react';
import {z} from 'zod';
import {TextField as MuiTextField, Typography} from '@mui/material';
import FieldWrapper from '../wrappers/FieldWrapper';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {
  DataViewFieldRender,
  EmptyResponsePlaceholder,
} from '../../../rendering';
import {FieldReturnType, FieldInfo} from '../../types';

// =============================================================================
// Props Schema
// =============================================================================

const dateTimePropsSchema = BaseFieldPropsSchema.extend({
  fullWidth: z.boolean().optional().default(true),
  variant: z
    .enum(['outlined', 'filled', 'standard'])
    .optional()
    .default('outlined'),
});

type DateTimeFieldProps = z.infer<typeof dateTimePropsSchema>;

// Full props including injected form context
type DateTimeFieldFullProps = FullFieldProps & DateTimeFieldProps;

// =============================================================================
// Base Component
// =============================================================================

interface DateTimeBaseProps extends DateTimeFieldFullProps {
  inputType: HTMLInputTypeAttribute;
  previewLabel: string;
}

const DateTimeBase: React.FC<DateTimeBaseProps> = props => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    fullWidth,
    disabled,
    state,
    setFieldData,
    handleBlur,
    config,
    inputType,
    previewLabel,
  } = props;

  // Handle preview mode
  if (config.mode === 'preview') {
    return (
      <FieldWrapper heading={label} subheading={helperText}>
        <Typography color="text.secondary">{previewLabel}</Typography>
      </FieldWrapper>
    );
  }

  // Get current value and errors
  const value = state.value?.data ?? '';
  const errors = state.meta.errors as unknown as string[] | undefined;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <MuiTextField
        type={inputType}
        value={value}
        onChange={e => {
          const newValue = e.target.value.trim() === '' ? '' : e.target.value;
          setFieldData(newValue);
        }}
        onBlur={handleBlur}
        variant="outlined"
        fullWidth={fullWidth ?? true}
        disabled={disabled}
        required={required}
        error={Boolean(errors && errors.length > 0)}
        InputLabelProps={{
          shrink: true,
        }}
      />
    </FieldWrapper>
  );
};

// =============================================================================
// Field Components
// =============================================================================

const DateTimePickerField: React.FC<DateTimeFieldFullProps> = props => {
  return (
    <DateTimeBase
      {...props}
      inputType="datetime-local"
      previewLabel="Date & Time Picker"
    />
  );
};

const DatePickerField: React.FC<DateTimeFieldFullProps> = props => {
  return (
    <DateTimeBase {...props} inputType="date" previewLabel="Date Picker" />
  );
};

const MonthPickerField: React.FC<DateTimeFieldFullProps> = props => {
  return (
    <DateTimeBase {...props} inputType="month" previewLabel="Month Picker" />
  );
};

// =============================================================================
// View Components
// =============================================================================

/**
 * Formats a datetime-local value for display
 */
const formatDateTime = (value: string): string => {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
};

/**
 * Formats a date value for display
 */
const formatDate = (value: string): string => {
  if (!value) return '';
  try {
    const date = new Date(value + 'T00:00:00'); // Ensure parsing as local date
    return date.toLocaleDateString();
  } catch {
    return value;
  }
};

/**
 * Formats a month value for display
 */
const formatMonth = (value: string): string => {
  if (!value) return '';
  try {
    // value is in format YYYY-MM
    const [year, month] = value.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long'});
  } catch {
    return value;
  }
};

const DateTimePickerRenderer: DataViewFieldRender = props => {
  const {value} = props;
  if (!value) {
    return <EmptyResponsePlaceholder />;
  }
  return <Typography>{formatDateTime(value)}</Typography>;
};

const DatePickerRenderer: DataViewFieldRender = props => {
  const {value} = props;
  if (!value) {
    return <EmptyResponsePlaceholder />;
  }
  return <Typography>{formatDate(value)}</Typography>;
};

const MonthPickerRenderer: DataViewFieldRender = props => {
  const {value} = props;
  if (!value) {
    return <EmptyResponsePlaceholder />;
  }
  return <Typography>{formatMonth(value)}</Typography>;
};

// =============================================================================
// Validation Schema Functions
// =============================================================================

const dateTimeDataSchemaFunction = (props: DateTimeFieldProps) => {
  let schema = z.string();

  if (props.required) {
    schema = schema.min(1, {message: 'This field is required'});
  }

  return schema;
};

// =============================================================================
// Field Specs
// =============================================================================

const NAMESPACE = 'faims-custom';
const RETURN_TYPE: FieldReturnType = 'faims-core::String';

export const dateTimePickerFieldSpec: FieldInfo<DateTimeFieldFullProps> = {
  namespace: NAMESPACE,
  name: 'DateTimePicker',
  returns: RETURN_TYPE,
  component: DateTimePickerField,
  view: {
    component: DateTimePickerRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
  fieldPropsSchema: dateTimePropsSchema,
  fieldDataSchemaFunction: dateTimeDataSchemaFunction,
};

export const datePickerFieldSpec: FieldInfo<DateTimeFieldFullProps> = {
  namespace: NAMESPACE,
  name: 'DatePicker',
  returns: RETURN_TYPE,
  component: DatePickerField,
  view: {
    component: DatePickerRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
  fieldPropsSchema: dateTimePropsSchema,
  fieldDataSchemaFunction: dateTimeDataSchemaFunction,
};

export const monthPickerFieldSpec: FieldInfo<DateTimeFieldFullProps> = {
  namespace: NAMESPACE,
  name: 'MonthPicker',
  returns: RETURN_TYPE,
  component: MonthPickerField,
  view: {
    component: MonthPickerRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
  fieldPropsSchema: dateTimePropsSchema,
  fieldDataSchemaFunction: dateTimeDataSchemaFunction,
};
