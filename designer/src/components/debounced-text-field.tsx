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

import {TextField, TextFieldProps} from '@mui/material';
import React, {useEffect, useState, useRef, ChangeEvent} from 'react';
import { debounce } from 'lodash';

export interface DebouncedTextFieldProps
  extends Omit<TextFieldProps, 'onChange'> {

  /** The debounce delay in milliseconds (default is 200ms) */
  debounceTime?: number;

  /**
   * onChange callback that will be fired after the delay.
   */
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  
}

const DebouncedTextField: React.FC<DebouncedTextFieldProps> = ({
  name,
  value,
  onChange,
  debounceTime = 200,
  ...other
}) => {

  const [innerValue, setInnerValue] = useState<unknown>(value ?? '');

  // Create ONE debounced function and store it in a ref
  const debouncedOnChange = useRef(
    debounce((newValue: string | number) => {
      const event = {
        target: { name, value: newValue },
      } as ChangeEvent<HTMLInputElement>;
      console.log('FIRING');
      onChange(event);
    }, debounceTime)
  ).current;

  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  // Update local state if external `value` changes
  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  // Fire debounced onChange whenever local input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInnerValue(e.target.value);
    debouncedOnChange(e.target.value);
  };

  return <TextField {...other} value={innerValue} onChange={handleChange} />;

};

export default DebouncedTextField;