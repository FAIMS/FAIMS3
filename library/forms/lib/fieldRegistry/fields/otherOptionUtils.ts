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
 * Shared utilities for "Other" option functionality across
 * RadioGroup, Select, and MultiSelect fields.
 */

import {SxProps, Theme} from '@mui/material';

// ============================================================================
// Constants
// ============================================================================

/**
 * Internal marker used to identify the "Other" option in UI state.
 * This value is used in the select/radio controls but NOT stored in data.
 */
export const OTHER_MARKER = '__other__';

/**
 * Prefix used when storing "Other" option values in the data.
 * When a user enters custom text, it's stored as "Other: <their text>".
 * This allows distinguishing custom values from predefined options.
 */
export const OTHER_PREFIX = 'Other: ';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a value is an "Other" option value (has the prefix).
 */
export const isOtherOptionValue = (value: string): boolean => {
  return value.startsWith(OTHER_PREFIX);
};

/**
 * Extracts the text part from an "Other" option value.
 * Returns empty string if the value doesn't have the prefix.
 */
export const extractOtherText = (value: string): string => {
  if (isOtherOptionValue(value)) {
    return value.slice(OTHER_PREFIX.length);
  }
  return '';
};

/**
 * Creates an "Other" option value with the prefix.
 */
export const createOtherValue = (text: string): string => {
  return OTHER_PREFIX + text;
};

// ============================================================================
// Shared Styles
// ============================================================================

/**
 * Common TextField styles for the "Other" option input field.
 * Used across RadioGroup, Select, and MultiSelect components.
 */
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
