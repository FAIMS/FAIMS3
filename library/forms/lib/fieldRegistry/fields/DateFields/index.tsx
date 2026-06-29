/**
 * DateTime Fields
 *
 * Provides date and time input fields using native HTML input types.
 * Exports separate field specs for:
 * - DateTimePicker (datetime-local; optional auto-pick and optional "Now" button)
 * - DatePicker (date; optional "Today" button)
 * - MonthPicker (month; optional "This month" button)
 *
 * The legacy `DateTimeNow` field is no longer registered here. v4 notebook
 * migration rewrites `DateTimeNow` data to `DateTimePicker` with
 * `show_now_button: true`, and a registry alias keeps un-migrated data
 * resolving to `DateTimePicker` during rollout.
 */

import {
  Button,
  TextField as MuiTextField,
  Stack,
  Typography,
} from '@mui/material';
import React, {HTMLInputTypeAttribute, useEffect} from 'react';
import {z} from 'zod';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FullFieldProps} from '../../../formModule/types';
import {
  DataViewFieldRender,
  EmptyResponsePlaceholder,
} from '../../../rendering/fields';
import {FieldInfo, FieldReturnType} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// =============================================================================
// Props Schema
// =============================================================================

export const dateTimePropsSchema = BaseFieldParametersSchema.extend({
  fullWidth: z.boolean().optional().default(true),
  variant: z
    .enum(['outlined', 'filled', 'standard'])
    .optional()
    .default('outlined'),
  /**
   * When true, auto-populate the field with current datetime on first mount
   * if no value is currently set.
   */
  isAutoPick: z.boolean().optional(),
  is_auto_pick: z.boolean().optional(),
  /**
   * When true, renders a "Now" button that sets the field to the current datetime.
   */
  show_now_button: z.boolean().optional().default(false),
});

export type DateTimeFieldProps = z.infer<typeof dateTimePropsSchema>;

// Full props including injected form context
type DateTimeFieldFullProps = FullFieldProps & DateTimeFieldProps;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns the local "now" value formatted for the given HTML input type.
 * - datetime-local → yyyy-MM-ddTHH:mm:ss
 * - date           → yyyy-MM-dd
 * - month          → yyyy-MM
 */
const getLocalNowValue = (inputType: HTMLInputTypeAttribute): string => {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString();
  if (inputType === 'month') return local.slice(0, 7);
  if (inputType === 'date') return local.slice(0, 10);
  return local.slice(0, 19);
};

// =============================================================================
// Base Component
// =============================================================================

interface DateTimeBaseProps extends DateTimeFieldFullProps {
  inputType: HTMLInputTypeAttribute;
  /** Label for the optional "Now" button (shown when show_now_button is true). */
  nowButtonLabel: string;
}

const DateTimeBase: React.FC<DateTimeBaseProps> = ({
  label,
  helperText,
  required,
  advancedHelperText,
  fullWidth,
  disabled,
  state,
  setFieldData,
  handleBlur,
  isAutoPick,
  is_auto_pick,
  show_now_button,
  inputType,
  nowButtonLabel,
}) => {
  const value = (state.value?.data as string) ?? '';
  const errors = state.meta.errors as unknown as string[] | undefined;
  const autoPickEnabled = isAutoPick ?? is_auto_pick ?? false;

  // Hooks must be called before any conditional return.
  useEffect(() => {
    if (autoPickEnabled && !value) {
      setFieldData(getLocalNowValue(inputType));
    }
    // Only run on mount to avoid overriding user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNowClick = () => setFieldData(getLocalNowValue(inputType));

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
          type={inputType}
          value={value}
          onChange={e => {
            const next = e.target.value.trim();
            setFieldData(next === '' ? '' : next);
          }}
          onBlur={handleBlur}
          variant="outlined"
          fullWidth={fullWidth ?? true}
          disabled={disabled}
          required={required}
          error={Boolean(errors && errors.length > 0)}
          slotProps={{
            htmlInput: {
              step: inputType === 'datetime-local' ? 1 : undefined,
              shrink: true,
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: show_now_button
                ? {xs: '4px', sm: '4px 0 0 4px'}
                : 1,
            },
          }}
        />
        {show_now_button && (
          <Button
            variant="contained"
            disableElevation
            aria-label={nowButtonLabel}
            onClick={handleNowClick}
            sx={{
              borderRadius: {xs: '4px', sm: '0 4px 4px 0'},
              minWidth: {xs: 'auto', sm: '80px'},
              whiteSpace: 'nowrap',
            }}
          >
            {nowButtonLabel}
          </Button>
        )}
      </Stack>
    </FieldWrapper>
  );
};

// =============================================================================
// Field Components
// =============================================================================

const DateTimePickerField: React.FC<DateTimeFieldFullProps> = props => (
  <DateTimeBase {...props} inputType="datetime-local" nowButtonLabel="Now" />
);

const DatePickerField: React.FC<DateTimeFieldFullProps> = props => (
  <DateTimeBase
    {...props}
    inputType="date"
    nowButtonLabel="Select today's date"
  />
);

const MonthPickerField: React.FC<DateTimeFieldFullProps> = props => (
  <DateTimeBase
    {...props}
    inputType="month"
    nowButtonLabel="Select current month"
  />
);

// =============================================================================
// View Components
// =============================================================================

/**
 * Converts a datetime-local input value to ISO string for storage.
 *
 * @param localValue - Value from datetime-local input (yyyy-MM-ddTHH:mm:ss)
 * @returns ISO format datetime string
 */
export const localDisplayToIso = (localValue: string): string => {
  if (!localValue) return '';
  try {
    const date = new Date(localValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
};

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
