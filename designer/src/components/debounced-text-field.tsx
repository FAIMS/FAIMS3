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

import React, {useState, useEffect} from 'react';
import {TextField, TextFieldProps} from '@mui/material';

export interface DebouncedTextFieldProps
  extends Omit<TextFieldProps, 'onChange'> {
  /** The debounce delay in milliseconds (default is 300ms) */
  debounceTime?: number;
  /**
   * onChange callback that will be fired after the delay.
   */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DebouncedTextField: React.FC<DebouncedTextFieldProps> = props => {
  const {debounceTime = 300, onChange, value, ...other} = props;
  const [innerValue, setInnerValue] = useState(value ?? '');

  // Update inner value when the parent's value changes.
  useEffect(() => {
    setInnerValue(value ?? '');
  }, [value]);

  // Debounce onChange calls.
  useEffect(() => {
    const handler = setTimeout(() => {
      if (onChange) {
        const syntheticEvent = {
          target: {value: innerValue},
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [innerValue, debounceTime, onChange]);

  // Handle immediate changes by updating the local state.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInnerValue(e.target.value);
  };

  return <TextField {...other} value={innerValue} onChange={handleChange} />;
};

export default DebouncedTextField;
