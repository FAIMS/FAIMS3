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
 * Filename: select.tsx
 * Description:
 *   TODO
 */

import {ElementOption} from '@faims3/data-model';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {FieldProps} from 'formik';
import {TextFieldProps} from 'formik-mui';
import {ReactNode} from 'react';

/**
 * Base properties for multi-select components
 */
interface ElementProps {
  options: Array<ElementOption>;
  expandedChecklist?: boolean;
  exclusiveOptions?: Array<string>;
}

/**
 * Combined props for the main MultiSelect component
 */
interface Props {
  ElementProps: ElementProps;
  select_others?: string;
}

/**
 * Props for the ExpandedChecklist component
 */
interface ExpandedChecklistProps {
  options: Array<ElementOption>;
  value: string[];
  onChange: (values: string[]) => void;
  label?: ReactNode;
  helperText?: ReactNode;
}

/**
 * Props for the MuiMultiSelect component
 */
interface MuiMultiSelectProps {
  options: Array<ElementOption>;
  value: string[];
  onChange: (values: string[]) => void;
  label?: ReactNode;
  helperText?: ReactNode;
}

/**
 * A component that displays options as an expanded list of checkboxes
 */
export const ExpandedChecklist = ({
  options,
  value,
  onChange,
  label,
  helperText,
}: ExpandedChecklistProps) => {
  const handleChange = (optionValue: string) => {
    const newValues = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValues);
  };

  return (
    <FormControl sx={{width: '100%'}}>
      {label && (
        <Typography variant="subtitle1" gutterBottom>
          {label}
        </Typography>
      )}
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
        {options.map(option => (
          <FormControlLabel
            key={option.key || option.value}
            control={
              <Checkbox
                checked={value.includes(option.value)}
                onChange={() => handleChange(option.value)}
              />
            }
            label={option.label}
            sx={{
              '& .MuiFormControlLabel-label': {
                whiteSpace: 'normal',
                wordWrap: 'break-word',
              },
            }}
          />
        ))}
      </Box>
    </FormControl>
  );
};

/**
 * A component that displays options in a Material-UI dropdown select
 */
export const MuiMultiSelect = ({
  options,
  value,
  onChange,
  label,
  helperText,
}: MuiMultiSelectProps) => {
  const theme = useTheme();

  return (
    <FormControl sx={{m: 1, width: '100%'}}>
      <InputLabel
        id="multi-select-label"
        style={{backgroundColor: theme.palette.background.default}}
      >
        {label}
      </InputLabel>
      <Select
        labelId="multi-select-label"
        multiple
        label={label}
        onChange={(e: any) => onChange(e.target.value)}
        value={value}
        input={<OutlinedInput label={label} />}
        renderValue={selected => selected.join(', ')}
      >
        {options.map(option => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
            sx={{
              whiteSpace: 'normal',
              wordWrap: 'break-word',
            }}
          >
            <Checkbox checked={value.includes(option.value)} />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

/**
 * Main MultiSelect component that switches between ExpandedChecklist and MuiMultiSelect
 * based on the expandedChecklist prop
 */
export const MultiSelect = (props: FieldProps & Props & TextFieldProps) => {
  const handleChange = (value: string[]) => {
    props.form.setFieldValue(props.field.name, value, true);
  };

  const isExpandedChecklist = props.ElementProps.expandedChecklist ?? false;

  const commonProps = {
    options: props.ElementProps.options,
    value: props.field.value,
    onChange: handleChange,
    label: props.label,
    helperText: props.helperText,
  };

  return isExpandedChecklist ? (
    <ExpandedChecklist {...commonProps} />
  ) : (
    <MuiMultiSelect {...commonProps} />
  );
};

/*
An example of ui-spec for this multi-select:
{
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'MultiSelect',
  'type-returned': 'faims-core::Array', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'Choose items from the dropdown',
    variant: 'outlined',
    required: false,
    select: true,
    InputProps: {},
    SelectProps: {
      multiple: true,
    },
    ElementProps: {
      // expanded check list form vs default dropdown
      expandedChecklist : false,
      options: [
        {
          value: 'Default',
          label: 'Default',
        },
        {
          value: 'Default2',
          label: 'Default2',
        },
      ],
    },
    InputLabelProps: {
      label: 'Select Multiple',
    },
  },
  validationSchema: [['yup.array']],
  initialValue: [],
};

*/
