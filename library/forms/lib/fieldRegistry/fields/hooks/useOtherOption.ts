/*

 * Shared utilities for "Other" option functionality across
 * RadioGroup, Select, and MultiSelect fields.
 */

import {SxProps, Theme} from '@mui/material';
import {useState, useEffect} from 'react';

// UI marker for "Other" selection (not stored in data)
export const OTHER_MARKER = '__other__';

// Prefix for stored "Other" values, e.g. "Other: custom text"
export const OTHER_PREFIX = 'Other: ';

export const isOtherOptionValue = (value: string): boolean => {
  return value.startsWith(OTHER_PREFIX);
};

export const extractOtherText = (value: string): string => {
  return isOtherOptionValue(value) ? value.slice(OTHER_PREFIX.length) : '';
};

export const createOtherValue = (text: string): string => {
  return OTHER_PREFIX + text;
};

export const otherTextFieldSx: SxProps<Theme> = {
  '& .MuiInput-input': {
    color: 'rgba(0, 0, 0, 0.87)',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
  },
  '& .MuiInput-input::placeholder': {
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 1,
  },
  '& .MuiInput-underline:before': {
    borderBottomColor: 'rgba(0, 0, 0, 0.42)',
  },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
    borderBottomColor: 'rgba(0, 0, 0, 0.87)',
  },
};

interface UseOtherOptionProps {
  enableOtherOption: boolean;
  rawValue: string | string[];
  predefinedValues: string[];
  setFieldData: (value: any) => void;
  emptyErrorMessage?: string;
}

interface UseOtherOptionReturn {
  otherSelected: boolean;
  setOtherSelected: (selected: boolean) => void;
  otherFieldTouched: boolean;
  setOtherFieldTouched: (touched: boolean) => void;
  hasOtherSelected: boolean;
  otherText: string;
  otherFieldError: string | null;
  handleOtherTextChange: (text: string) => void;
}

/**
 * Hook for managing "Other" option state. Handles UI selection state,
 * text input, validation, and syncing between UI and stored data.
 */
export const useOtherOption = ({
  enableOtherOption,
  rawValue,
  predefinedValues,
  setFieldData,
  emptyErrorMessage = 'Please enter text for the "Other" option',
}: UseOtherOptionProps): UseOtherOptionReturn => {
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherFieldTouched, setOtherFieldTouched] = useState(false);

  // Check if stored data has an "Other: xxx" value
  const hasStoredOtherValue = Array.isArray(rawValue)
    ? rawValue.some(v => isOtherOptionValue(v))
    : typeof rawValue === 'string' && isOtherOptionValue(rawValue);

  const hasOtherSelected =
    enableOtherOption && (otherSelected || hasStoredOtherValue);

  const otherText = Array.isArray(rawValue)
    ? extractOtherText(rawValue.find(v => isOtherOptionValue(v)) || '')
    : typeof rawValue === 'string'
      ? extractOtherText(rawValue)
      : '';

  const otherFieldError =
    hasOtherSelected && otherFieldTouched && otherText.trim() === ''
      ? emptyErrorMessage
      : null;

  // Sync UI state when data changes
  useEffect(() => {
    if (hasStoredOtherValue && !otherSelected) {
      setOtherSelected(true);
    }
  }, [hasStoredOtherValue, otherSelected]);

  // Mark touched when checkbox is clicked for immediate validation
  useEffect(() => {
    if (otherSelected && !otherFieldTouched) {
      setOtherFieldTouched(true);
    }
  }, [otherSelected, otherFieldTouched]);

  const handleOtherTextChange = (text: string) => {
    if (Array.isArray(rawValue)) {
      const predefined = rawValue.filter(v => predefinedValues.includes(v));
      setFieldData(
        text.trim() ? [...predefined, createOtherValue(text)] : predefined
      );
    } else {
      setFieldData(text.trim() ? createOtherValue(text) : '');
    }
  };

  return {
    otherSelected,
    setOtherSelected,
    otherFieldTouched,
    setOtherFieldTouched,
    hasOtherSelected,
    otherText,
    otherFieldError,
    handleOtherTextChange,
  };
};
