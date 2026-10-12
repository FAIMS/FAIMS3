// SPDX-License-Identifier: Apache-2.0
/**
 * @file Autocomplete picker for named expression constants, styled to match
 * FieldSearchAutocomplete so the computed field editor's pickers read as one set.
 */

import {TextField} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {useState} from 'react';
import {encodeConstantRef, EXPRESSION_CONSTANTS} from '@faims3/data-model';
import {designerHtmlInput, INPUT_LIMITS} from '../../lib/input-limits';
import {SearchResultContent} from '../../features/search';

type ConstantOption = {
  name: string;
  ref: string;
  approx: string;
};

// One option per constant, with an approximate value for display.
const CONSTANT_OPTIONS: ConstantOption[] = [...EXPRESSION_CONSTANTS].map(
  ([name, value]) => ({
    name,
    ref: encodeConstantRef(name),
    approx: value.toPrecision(6),
  })
);

export type ConstantSearchAutocompleteProps = {
  /** Called with the braced-ready reference, e.g. _CONSTANT.PI. */
  onSelect: (ref: string) => void;
  label?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  minWidth?: number | string;
  'data-testid'?: string;
};

/**
 * Compact autocomplete for inserting a named constant. Always acts as a
 * picker: the input clears after each selection.
 */
export const ConstantSearchAutocomplete = ({
  onSelect,
  label = 'Insert constant',
  placeholder = 'Search constants…',
  size = 'small',
  minWidth = 200,
  'data-testid': testId,
}: ConstantSearchAutocompleteProps) => {
  const [query, setQuery] = useState('');

  return (
    <Autocomplete
      options={CONSTANT_OPTIONS}
      value={null}
      inputValue={query}
      onInputChange={(_, newInput, reason) => {
        if (reason === 'input' || reason === 'clear') setQuery(newInput);
      }}
      onChange={(_, option) => {
        if (option) onSelect(option.ref);
        setQuery('');
      }}
      getOptionLabel={option => option.name}
      // Match on name or full reference so "pi" and "_CONSTANT.PI" both hit.
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase();
        if (!q) return options;
        return options.filter(
          o =>
            o.name.toLowerCase().includes(q) || o.ref.toLowerCase().includes(q)
        );
      }}
      noOptionsText="No matching constants"
      clearOnEscape
      data-testid={testId}
      size={size}
      sx={{minWidth}}
      renderOption={(props, option) => (
        <li
          {...props}
          key={option.ref}
          style={{...props.style, display: 'flex', width: '100%'}}
        >
          <SearchResultContent
            title={`${option.name} ≈ ${option.approx}`}
            location={`{${option.ref}}`}
          />
        </li>
      )}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          variant="outlined"
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...(params.slotProps?.htmlInput as object | undefined),
              ...designerHtmlInput(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
            },
          }}
        />
      )}
    />
  );
};
