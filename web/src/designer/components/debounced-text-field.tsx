// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import React, {
  useState,
  useEffect,
  useMemo,
  ChangeEvent,
  FocusEvent,
} from 'react';
import {TextField, TextFieldProps} from '@mui/material';
import debounce from 'lodash/debounce';

export interface DebouncedTextFieldProps
  extends Omit<TextFieldProps, 'onChange'> {
  /**
   * Debounce delay in milliseconds (default is 200ms)
   */
  debounceTime?: number;

  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

const DEFAULT_DEBOUNCE_MS = 200;

const DebouncedTextField: React.FC<DebouncedTextFieldProps> = ({
  value,
  onChange,
  debounceTime = DEFAULT_DEBOUNCE_MS,
  onBlur,
  ...rest
}) => {
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));

  // Sync local state with external value
  useEffect(() => {
    setLocalValue(String(value ?? ''));
  }, [value]);

  // Create debounced version of onChange
  const debouncedChange = useMemo(() => {
    if (!onChange) return undefined;

    return debounce(
      (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e);
      },
      debounceTime,
      {leading: false, trailing: true}
    );
  }, [onChange, debounceTime]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      debouncedChange?.flush();
    };
  }, [debouncedChange]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    debouncedChange?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    debouncedChange?.flush();
    onBlur?.(e);
  };

  return (
    <TextField
      {...rest}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default DebouncedTextField;
