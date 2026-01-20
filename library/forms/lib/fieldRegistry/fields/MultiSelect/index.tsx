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
 * MultiSelect Component
 *
 * This component renders a multi-selection field using Material-UI.
 * It supports two display modes:
 * - Expanded checklist: displays all options as checkboxes
 * - Dropdown select: displays options in a multi-select dropdown
 *
 * Features:
 * - Exclusive options: certain options can be configured to deselect all others when chosen
 * - Rich text labels: option labels support sanitized HTML content
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the options array, expandedChecklist flag, and exclusiveOptions.
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import React, {useState} from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {ListWrapper} from '../../../rendering/fields/view/wrappers/PrimitiveWrappers';
import {FieldInfo} from '../../types';
import {contentToSanitizedHtml} from '../RichText/DomPurifier';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  OTHER_MARKER,
  OTHER_PREFIX,
  extractOtherText,
  isOtherOptionValue,
  otherTextFieldSx,
  useOtherOption,
} from '../../../hooks/useOtherOption';

// ============================================================================
// Types & Schema
// ============================================================================

const ElementOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  key: z.string().optional(),
});

const MultiSelectFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    options: z.array(ElementOptionSchema),
    expandedChecklist: z.boolean().optional(),
    exclusiveOptions: z.array(z.string()).optional(),
    enableOtherOption: z.boolean().optional(),
  }),
});

type MultiSelectFieldProps = z.infer<typeof MultiSelectFieldPropsSchema>;
type ElementOption = z.infer<typeof ElementOptionSchema>;
type FieldProps = MultiSelectFieldProps & FullFieldProps;

// ============================================================================
// Sub-Components
// ============================================================================

interface ExpandedChecklistProps {
  options: ElementOption[];
  value: string[];
  onChange: (values: string[]) => void;
  exclusiveOptions: string[];
  disabled?: boolean;
  enableOtherOption?: boolean;
  otherText?: string;
  onOtherTextChange?: (text: string) => void;
  hasOtherSelected?: boolean;
  onBlur?: () => void;
}

const ExpandedChecklist = ({
  options,
  value,
  onChange,
  exclusiveOptions,
  disabled,
  enableOtherOption,
  otherText,
  onOtherTextChange,
  hasOtherSelected,
  onBlur,
}: ExpandedChecklistProps) => {
  const selectedExclusiveOption = value.find(v => exclusiveOptions.includes(v));

  const handleChange = (optionValue: string) => {
    if (optionValue === OTHER_MARKER) {
      if (hasOtherSelected) {
        onChange(value.filter(v => v !== OTHER_MARKER));
      } else {
        onChange([...value, OTHER_MARKER]);
      }
      return;
    }

    if (exclusiveOptions.includes(optionValue)) {
      onChange(value.includes(optionValue) ? [] : [optionValue]);
    } else {
      if (!selectedExclusiveOption) {
        const newValues = value.includes(optionValue)
          ? value.filter(v => v !== optionValue)
          : [...value, optionValue];
        onChange(newValues);
      }
    }
  };

  return (
    <FormControl sx={{width: '100%'}} disabled={disabled}>
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
                  (selectedExclusiveOption !== undefined &&
                    option.value !== selectedExclusiveOption) ||
                  disabled
                }
                sx={{
                  padding: '4px 8px 4px 0',
                }}
              />
            }
            label={
              <span
                style={{
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: '1.5',
                }}
                dangerouslySetInnerHTML={{
                  __html: contentToSanitizedHtml(option.label),
                }}
              />
            }
            sx={{
              alignItems: 'center',
              mb: 1,
              m: 0,
            }}
          />
        ))}

        {enableOtherOption && (
          <FormControlLabel
            control={
              <Checkbox
                checked={hasOtherSelected || false}
                onChange={() => handleChange(OTHER_MARKER)}
                disabled={selectedExclusiveOption !== undefined || disabled}
                sx={{
                  padding: '4px 8px 4px 0',
                }}
              />
            }
            label={
              <TextField
                size="small"
                placeholder="Other"
                value={otherText || ''}
                onChange={e => {
                  if (!hasOtherSelected && e.target.value.length > 0) {
                    onChange([...value, OTHER_MARKER]);
                  }
                  onOtherTextChange?.(e.target.value);
                }}
                onFocus={() => {
                  if (!hasOtherSelected) {
                    onChange([...value, OTHER_MARKER]);
                  }
                }}
                onBlur={onBlur}
                disabled={disabled}
                variant="standard"
                multiline
                sx={{
                  minWidth: '200px',
                  ...otherTextFieldSx,
                }}
              />
            }
            sx={{
              alignItems: 'center',
              m: 0,
            }}
          />
        )}
      </Box>
    </FormControl>
  );
};

interface MuiMultiSelectProps {
  options: ElementOption[];
  value: string[];
  onChange: (values: string[]) => void;
  exclusiveOptions: string[];
  disabled?: boolean;
  onBlur?: () => void;
  enableOtherOption?: boolean;
  otherText?: string;
  onOtherTextChange?: (text: string) => void;
  hasOtherSelected?: boolean;
}

const MuiMultiSelect = ({
  options,
  value,
  onChange,
  exclusiveOptions,
  disabled,
  onBlur,
  enableOtherOption,
  otherText,
  onOtherTextChange,
  hasOtherSelected,
}: MuiMultiSelectProps) => {
  // state to control dropdown open/close
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (event: any) => {
    const selectedValues = event.target.value;

    let exclusive = undefined;
    for (const v of selectedValues) {
      if (exclusiveOptions.includes(v)) {
        exclusive = v;
        break;
      }
    }

    if (exclusive) {
      onChange([exclusive]);
      return;
    }

    onChange(selectedValues);
  };

  const selectedExclusiveOption = value.find(v => exclusiveOptions.includes(v));

  return (
    <>
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
        disabled={disabled}
      >
        <Select
          multiple
          open={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          onChange={handleChange}
          onBlur={onBlur}
          value={value}
          renderValue={selected => {
            const displayText = (selected as string[])
              .map(v => {
                if (v === OTHER_MARKER) {
                  return otherText || 'Other';
                }
                if (isOtherOptionValue(v)) {
                  return extractOtherText(v) || 'Other';
                }
                return v;
              })
              .join(', ');

            return (
              <span
                dangerouslySetInnerHTML={{
                  __html: contentToSanitizedHtml(displayText),
                }}
              />
            );
          }}
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
              key={option.key || option.value}
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
              />
            </MenuItem>
          ))}

          {enableOtherOption && (
            <MenuItem
              value={OTHER_MARKER}
              disabled={selectedExclusiveOption !== undefined}
              sx={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                display: 'flex',
                alignItems: 'flex-start',
                padding: '8px 16px',
              }}
              onKeyDown={e => {
                e.stopPropagation();
              }}
            >
              <Checkbox
                checked={hasOtherSelected || false}
                sx={{mr: 1, alignSelf: 'flex-start', mt: '4px'}}
              />
              <TextField
                size="small"
                placeholder="Other"
                value={otherText || ''}
                onChange={e => {
                  e.stopPropagation();
                  if (!hasOtherSelected && e.target.value.length > 0) {
                    onChange([...value, OTHER_MARKER]);
                  }
                  onOtherTextChange?.(e.target.value);
                }}
                onClick={e => {
                  e.stopPropagation();
                  if (!hasOtherSelected) {
                    onChange([...value, OTHER_MARKER]);
                  }
                }}
                onBlur={e => {
                  e.stopPropagation();
                  onBlur?.();
                }}
                onKeyDown={e => {
                  e.stopPropagation();
                  // save and close dropdown on Enter key
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                  }
                }}
                disabled={disabled}
                variant="standard"
                multiline
                fullWidth
                sx={{
                  flex: 1,
                  ...otherTextFieldSx,
                  '& .MuiInput-input': {
                    ...((otherTextFieldSx as any)['& .MuiInput-input'] || {}),
                    padding: '4px 0',
                  },
                }}
              />
            </MenuItem>
          )}
        </Select>
      </FormControl>
    </>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const MultiSelect = (props: FieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    handleBlur,
    ElementProps,
  } = props;

  const rawValue = state.value?.data;
  const value: string[] = Array.isArray(rawValue)
    ? rawValue
    : rawValue === '' || rawValue === undefined || rawValue === null
      ? []
      : [rawValue as string];

  const isExpandedChecklist = ElementProps.expandedChecklist ?? false;
  const exclusiveOptions = ElementProps.exclusiveOptions ?? [];
  const enableOtherOption = ElementProps.enableOtherOption ?? false;
  const predefinedValues = ElementProps.options.map(opt => opt.value);

  const {setOtherSelected, hasOtherSelected, otherText, handleOtherTextChange} =
    useOtherOption({
      enableOtherOption,
      rawValue: value,
      predefinedValues,
      setFieldData,
    });

  const selectedPredefined = value.filter(v => predefinedValues.includes(v));
  const otherValues = value.filter(v => isOtherOptionValue(v));

  const handleChange = (newValues: string[]) => {
    if (enableOtherOption) {
      const hasOtherMarker = newValues.includes(OTHER_MARKER);

      const realValues = newValues.filter(
        v => v !== OTHER_MARKER && !isOtherOptionValue(v)
      );

      if (hasOtherMarker) {
        if (otherValues.length > 0) {
          // Preserve existing "Other: xxx" value
          setFieldData([...realValues, ...otherValues]);
        } else {
          // Store empty "Other: " so Zod can validate it
          setOtherSelected(true);
          setFieldData([...realValues, OTHER_PREFIX]);
        }
      } else {
        setOtherSelected(false);
        setFieldData(realValues);
      }
    } else {
      setFieldData(newValues);
    }
  };

  const uiValue = hasOtherSelected
    ? [...selectedPredefined, OTHER_MARKER]
    : selectedPredefined;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <Box sx={{mt: 2, mb: 2}}>
        {isExpandedChecklist ? (
          <ExpandedChecklist
            options={ElementProps.options}
            value={uiValue}
            onChange={handleChange}
            exclusiveOptions={exclusiveOptions}
            disabled={disabled}
            enableOtherOption={enableOtherOption}
            otherText={otherText}
            onOtherTextChange={handleOtherTextChange}
            hasOtherSelected={hasOtherSelected}
            onBlur={handleBlur}
          />
        ) : (
          <MuiMultiSelect
            options={ElementProps.options}
            value={uiValue}
            onChange={handleChange}
            exclusiveOptions={exclusiveOptions}
            disabled={disabled}
            onBlur={handleBlur}
            enableOtherOption={enableOtherOption}
            otherText={otherText}
            onOtherTextChange={handleOtherTextChange}
            hasOtherSelected={hasOtherSelected}
          />
        )}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

const valueSchema = (props: MultiSelectFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  const enableOtherOption = props.ElementProps.enableOtherOption ?? false;

  if (optionValues.length === 0) {
    const baseSchema = z.array(z.string());
    return props.required
      ? baseSchema.min(1, {message: 'Please select at least one option'})
      : baseSchema;
  }

  if (enableOtherOption) {
    const baseSchema = z.array(z.string());

    if (props.required) {
      return baseSchema
        .min(1, {message: 'Please select at least one option'})
        .refine(
          values => {
            // Aother values must have text for eg. - Other: text
            return values.every(v => {
              if (optionValues.includes(v)) return true;
              if (v.startsWith(OTHER_PREFIX)) {
                return v.slice(OTHER_PREFIX.length).trim().length > 0;
              }
              return false;
            });
          },
          {
            message: 'Please enter text for the "Other" option or uncheck it',
          }
        );
    }

    //  vaalidate "Other" values have text if present
    return baseSchema.refine(
      values => {
        return values.every(v => {
          if (optionValues.includes(v)) return true;
          if (v.startsWith(OTHER_PREFIX)) {
            return v.slice(OTHER_PREFIX.length).trim().length > 0;
          }
          return false;
        });
      },
      {
        message: 'Please enter text for the "Other" option or uncheck it',
      }
    );
  }

  const baseSchema = z.array(z.enum(optionValues as [string, ...string[]]));

  return props.required
    ? baseSchema.min(1, {message: 'Please select at least one option'})
    : baseSchema;
};

// ============================================================================
// Field Registration
// ============================================================================

export const multiSelectFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'MultiSelect',
  returns: 'faims-core::Array',
  component: MultiSelect,
  fieldPropsSchema: MultiSelectFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {
    component: props => {
      let content: string[] = [];
      if (Array.isArray(props.value)) {
        content = props.value;
      }
      return <ListWrapper content={content}></ListWrapper>;
    },
    config: {},
  },
};
