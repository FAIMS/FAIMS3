/**
 * DateTime Fields
 *
 * Provides date and time input fields using native HTML input types.
 * Exports separate field specs for:
 * - DateTimePicker (datetime-local)
 * - DatePicker (date)
 * - MonthPicker (month)
 * - DateTimeNow (datetime-local with "Now" button and optional auto-pick)
 */

import {
  Button,
  TextField as MuiTextField,
  Stack,
  Typography,
} from '@mui/material';
import React, {HTMLInputTypeAttribute, useEffect} from 'react';
import {z} from 'zod';
import {isoToLocalDisplay, localDisplayToIso} from '../../../formModule';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {
  DataViewFieldRender,
  EmptyResponsePlaceholder,
} from '../../../rendering';
import {FieldInfo, FieldReturnType} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

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
// DateTimeNow Props Schema
// =============================================================================

/**
 * Extended props schema for DateTimeNow field.
 *
 * Adds is_auto_pick option which automatically populates the field with the
 * current datetime when the form is first opened (only if the field is empty).
 */
const dateTimeNowPropsSchema = dateTimePropsSchema.extend({
  /**
   * When true, automatically sets the field to the current datetime on mount
   * if the field value is empty. Useful for timestamp fields that should
   * capture when a record was started.
   */
  is_auto_pick: z.boolean().optional().default(false),
});

type DateTimeNowFieldProps = z.infer<typeof dateTimeNowPropsSchema>;
type DateTimeNowFieldFullProps = FullFieldProps & DateTimeNowFieldProps;

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
// DateTimeNow Component
// =============================================================================

/**
 * DateTimeNow Field
 *
 * A datetime picker with a "Now" button that captures the current timestamp.
 * Stores values as ISO strings internally but displays using local datetime format.
 *
 * Features:
 * - "Now" button to quickly capture current datetime with 1-second precision
 * - Optional auto-pick on mount (is_auto_pick prop)
 * - ISO string storage for consistent timezone handling
 * - Local datetime display for user-friendly interaction
 *
 * Value storage:
 * - Internal storage: ISO string (e.g., "2024-01-15T10:30:00.000Z")
 * - Display format: yyyy-MM-ddTHH:mm:ss (local time)
 */
const DateTimeNowField: React.FC<DateTimeNowFieldFullProps> = props => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    fullWidth,
    state,
    setFieldData,
    handleBlur,
    is_auto_pick,
  } = props;

  // Get current stored value (ISO string) and convert to display format
  const storedValue = (state.value?.data as string) ?? '';
  const displayValue = isoToLocalDisplay(storedValue);
  const errors = state.meta.errors as unknown as string[] | undefined;

  /**
   * Handle input change - convert from local display format to ISO for storage
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim();
    if (inputValue === '') {
      setFieldData('');
    } else {
      const isoValue = localDisplayToIso(inputValue);
      setFieldData(isoValue);
    }
  };

  /**
   * Handle "Now" button click - capture current time to 1-second precision
   */
  const handleNowClick = () => {
    const now = new Date();
    setFieldData(now.toISOString());
  };

  /**
   * Auto-pick on mount if is_auto_pick is enabled and field is empty.
   * This matches the legacy behavior where the field auto-populates
   * when the user opens the form.
   */
  useEffect(() => {
    if (
      is_auto_pick &&
      (storedValue === null || storedValue === undefined || storedValue === '')
    ) {
      const now = new Date();
      setFieldData(now.toISOString());
    }
    // Only run on mount - we don't want to override user changes
  }, []);

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Stack direction={{xs: 'column', sm: 'row'}} spacing={{xs: 1, sm: 0}}>
        <MuiTextField
          type="datetime-local"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          variant="outlined"
          fullWidth={fullWidth ?? true}
          required={required}
          error={Boolean(errors && errors.length > 0)}
          inputProps={{
            step: 1, // Enable 1-second precision in the time picker
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: {xs: '4px', sm: '4px 0 0 4px'},
            },
          }}
          InputLabelProps={{
            shrink: true,
          }}
        />
        <Button
          variant="contained"
          disableElevation
          aria-label="Capture current time"
          onClick={handleNowClick}
          sx={{
            borderRadius: {xs: '4px', sm: '0 4px 4px 0'},
            minWidth: {xs: 'auto', sm: '80px'},
            whiteSpace: 'nowrap',
          }}
        >
          Now
        </Button>
      </Stack>
    </FieldWrapper>
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

/**
 * View renderer for DateTimeNow field.
 * Since the stored value is ISO format, we use the same formatter as DateTimePicker.
 */
const DateTimeNowRenderer: DataViewFieldRender = props => {
  const {value} = props;
  if (!value) {
    return <EmptyResponsePlaceholder />;
  }
  return <Typography>{formatDateTime(value)}</Typography>;
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

const dateTimeNowDataSchemaFunction = (props: DateTimeNowFieldProps) => {
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

export const dateTimeNowFieldSpec: FieldInfo<DateTimeNowFieldFullProps> = {
  namespace: NAMESPACE,
  name: 'DateTimeNow',
  returns: RETURN_TYPE,
  component: DateTimeNowField,
  view: {
    component: DateTimeNowRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
  fieldPropsSchema: dateTimeNowPropsSchema,
  fieldDataSchemaFunction: dateTimeNowDataSchemaFunction,
};
