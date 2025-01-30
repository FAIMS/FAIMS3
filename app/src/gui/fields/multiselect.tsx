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
 /*
 * MultiSelect Component
 *
 * This component renders a multi-select dropdown or an expanded checklist using Material-UI.
 * It integrates with Formik for managing form state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - Supports two display modes: a dropdown (default) and an expanded checklist (if enabled).
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * -required (boolean) : To know whether field is required or not.
 * - ElementProps (object): Contains the options and configuration for the multi-select.
 * - expandedChecklist (boolean, optional): If true, renders options as checkboxes instead of a dropdown.
 * - field (object): Formik field object for managing value.
 * - form (object): Formik form object for managing state and validation.
 */

import {ElementOption} from '@faims3/data-model';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {FieldProps} from 'formik';
import {TextFieldProps} from 'formik-mui';
import FieldWrapper from './fieldWrapper';

/**
 * Base properties for multi-select components
 */
interface ElementProps {
  options: Array<ElementOption>;
  expandedChecklist?: boolean;
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
}

/**
 * Props for the MuiMultiSelect component
 */
interface MuiMultiSelectProps {
  options: Array<ElementOption>;
  value: string[];
  onChange: (values: string[]) => void;
}

/**
 * A component that displays options as an expanded list of checkboxes
 */
export const ExpandedChecklist = ({
  options,
  value,
  onChange,
}: ExpandedChecklistProps) => {
  const handleChange = (optionValue: string) => {
    const newValues = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValues);
  };

  return (
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
  );
};

/**
 * A component that displays options in a Material-UI dropdown select
 */
export const MuiMultiSelect = ({
  options,
  value,
  onChange,
}: MuiMultiSelectProps) => {
  const theme = useTheme();

  return (
    <FormControl sx={{width: '100%'}}>
      <Select
        multiple
        onChange={(e: any) => onChange(e.target.value)}
        value={value}
        input={<OutlinedInput />}
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

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
    >
      {isExpandedChecklist ? (
        <ExpandedChecklist
          options={props.ElementProps.options}
          value={props.field.value}
          onChange={handleChange}
        />
      ) : (
        <MuiMultiSelect
          options={props.ElementProps.options}
          value={props.field.value}
          onChange={handleChange}
        />
      )}
    </FieldWrapper>
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
