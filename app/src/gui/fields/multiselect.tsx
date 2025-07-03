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
  ListItemText,
  MenuItem,
  Select,
} from '@mui/material';
import {FieldProps} from 'formik';
import {TextFieldProps} from 'formik-mui';
import {ReactNode} from 'react';
import FieldWrapper from './fieldWrapper';
import MarkdownIt from 'markdown-it';
import {contentToSanitizedHtml} from '../../utils/DomPurifier';

const md = new MarkdownIt({breaks: true, html: false});

/**
 * Base properties for multi-select components
 */
interface ElementProps {
  options: Array<ElementOption>;
  expandedChecklist?: boolean;
  exclusiveOptions?: Array<string>;
  advancedHelperText?: ReactNode;
}

/**
 * Combined props for the main MultiSelect component
 */
interface Props {
  ElementProps: ElementProps;
  select_others?: string;
  advancedHelperText?: ReactNode;
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
  exclusiveOptions?: Array<string>;
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
  exclusiveOptions?: Array<string>;
}

/**
 * A component that displays options as an expanded list of checkboxes
 */
export const ExpandedChecklist = ({
  options,
  value,
  onChange,
  exclusiveOptions = [],
}: ExpandedChecklistProps) => {
  const selectedExclusiveOption = value.find(v => exclusiveOptions.includes(v));

  const handleChange = (optionValue: string) => {
    // If the new selection is exclusive, then we either deselect all or select
    // just that value
    if (exclusiveOptions.includes(optionValue)) {
      onChange(value.includes(optionValue) ? [] : [optionValue]);
    } else {
      // As long as we don't have an exclusive option selected, add or remove
      // this option as per usual
      if (!selectedExclusiveOption) {
        const newValues = value.includes(optionValue)
          ? value.filter(v => v !== optionValue)
          : [...value, optionValue];
        onChange(newValues);
      }
    }
  };

  return (
    <FormControl sx={{width: '100%'}}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderBottom: '1px solid #eee',
          pb: 1.5,
        }}
      >
        {options.map(option => (
          <FormControlLabel
            key={option.key || option.value}
            control={
              <Checkbox
                checked={value.includes(option.value)}
                onChange={() => handleChange(option.value)}
                disabled={
                  selectedExclusiveOption !== undefined &&
                  option.value !== selectedExclusiveOption
                }
                sx={{
                  padding: '4px 8px 0 0',
                  alignSelf: 'flex-start',
                }}
              />
            }
            label={
              <span
                style={{
                  display: 'contents',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: '1.8rem',
                  paddingTop: '4px',
                }}
                dangerouslySetInnerHTML={{
                  __html: contentToSanitizedHtml(option.label),
                }}
              />
            }
            sx={{
              alignItems: 'center',
              mb: 1.5,
              m: 0, // reset default margins
              '& .MuiFormControlLabel-label': {
                marginTop: 0,
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
  exclusiveOptions = [],
}: MuiMultiSelectProps) => {
  const handleChange = (event: any) => {
    const selectedValues = event.target.value;

    // Check if any selection is exclusive, if so just update with that
    let exclusive = undefined;
    for (const v of selectedValues) {
      if (exclusiveOptions.includes(v)) {
        exclusive = v;
        break;
      }
    }

    // Just update with exclusive - deleting all other selections
    if (exclusive) {
      onChange([exclusive]);
      return;
    }

    // Otherwise, just update with the raw selection
    onChange(selectedValues);
  };

  const selectedExclusiveOption = value.find(v => exclusiveOptions.includes(v));

  return (
    <FormControl
      sx={{
        width: '100%',
        mt: 2,
        '& .MuiSelect-select': {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          padding: '12px',
        },
      }}
    >
      <Select
        multiple
        onChange={handleChange}
        value={value}
        renderValue={selected => selected.join(', ')}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 300,
              marginTop: 8,
            },
          },
        }}
      >
        {options.map(option => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
            disabled={
              selectedExclusiveOption !== undefined &&
              option.value !== selectedExclusiveOption
            }
            sx={{
              whiteSpace: 'normal',
              wordWrap: 'break-word',
            }}
          >
            <Checkbox checked={value.includes(option.value)} />
            <ListItemText
              primary={
                <span
                  style={{
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: contentToSanitizedHtml(option.label),
                  }}
                />
              }
            />{' '}
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

  // force value to be an array if it isn't already
  if (!Array.isArray(props.field.value)) {
    props.field.value = [props.field.value];
  }

  const commonProps = {
    options: props.ElementProps.options,
    value: props.field.value,
    onChange: handleChange,
    label: props.label,
    helperText: props.helperText,
    exclusiveOptions: props.ElementProps.exclusiveOptions,
    advancedHelperText: props.ElementProps.advancedHelperText,
  };

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <Box sx={{mt: 2, mb: 2}}>
        {isExpandedChecklist ? (
          <ExpandedChecklist {...commonProps} />
        ) : (
          <MuiMultiSelect {...commonProps} />
        )}
      </Box>
    </FieldWrapper>
  );
};

/*
An example of ui-spec for this multi-select:
{
  'component-namespace': 'faims-custom',
  'component-name': 'MultiSelect',
  'type-returned': 'faims-core::Array',
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
      expandedChecklist : false,
      exclusiveOptions : ['None', 'NotApplicable'],
      options: [
        {
          value: 'Option1',
          label: 'Option 1',
        },
        {
          value: 'Option2',
          label: 'Option 2',
        },
        {
          value: 'None',
          label: 'None of the above',
        },
        {
          value: 'NotApplicable',
          label: 'Not applicable',
        }
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
