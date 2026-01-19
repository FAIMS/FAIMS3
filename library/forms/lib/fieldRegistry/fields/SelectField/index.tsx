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
 * Select Component
 *
 * This component renders a dropdown select field using Material-UI.
 * It integrates with Formik for managing form state and includes:
 * - A heading (field label) rendered using FieldWrapper.
 * - A subheading (help text) rendered using FieldWrapper.
 * - A Material-UI dropdown select.
 *
 * Props:
 * - label (string, optional): The field label displayed as a heading.
 * - helperText (string, optional): The field help text displayed below the heading.
 * - ElementProps (object): Contains the dropdown options.
 * - field (object): Formik field object for managing value.
 * - required : To visually show if the field is required if it is.
 * - form (object): Formik form object for managing state and validation.
 */
import {
  FormControl,
  ListItemText,
  MenuItem,
  Select as MuiSelect,
  OutlinedInput,
  SelectChangeEvent,
  TextField,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import {contentToSanitizedHtml} from '../RichText/DomPurifier';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  OTHER_MARKER,
  OTHER_PREFIX,
  otherTextFieldSx,
  useOtherOption,
} from '../../../hooks/useOtherOption';

const SelectFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
        key: z.string().optional(),
      })
    ),
    enableOtherOption: z.boolean().optional(), // toggle to enable 'Other' option
  }),
  select_others: z.string().optional(),
});
type SelectFieldProps = z.infer<typeof SelectFieldPropsSchema>;

const valueSchema = (props: SelectFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  const enableOtherOption = props.ElementProps.enableOtherOption ?? false;

  // Handle edge case of no options defined
  if (optionValues.length === 0) {
    if (props.required) {
      return z.string().min(1, {message: 'Please select an option'});
    }
    return z.string();
  }

  if (enableOtherOption) {
    const baseSchema = z.string();

    if (props.required) {
      // Required: must have a value AND if "Other" is selected, must have text
      return baseSchema
        .min(1, {message: 'Please select or enter an option'})
        .refine(
          value => {
            if (optionValues.includes(value)) return true;
            if (value.startsWith(OTHER_PREFIX)) {
              return value.slice(OTHER_PREFIX.length).trim().length > 0;
            }
            return false;
          },
          {
            message:
              'Please enter text for the "Other" option or select a different option',
          }
        );
    }

    // Optional: allow empty or valid predefined options or valid "Other: xxx" values
    return baseSchema.refine(
      value => {
        if (value === '') return true;
        if (optionValues.includes(value)) return true;
        if (value.startsWith(OTHER_PREFIX)) {
          return value.slice(OTHER_PREFIX.length).trim().length > 0;
        }
        return false;
      },
      {
        message:
          'Please enter text for the "Other" option or select a different option',
      }
    );
  }

  // Valid option values schema
  const optionsSchema = z.enum(optionValues as [string, ...string[]]);

  if (props.required) {
    // Required: must be one of the valid options (not empty string)
    return optionsSchema;
  }

  // Optional: allow empty string for no selection, or a valid option
  return z.union([optionsSchema, z.literal('')]);
};

type FieldProps = SelectFieldProps & FullFieldProps;

/**
 * Select Component - A reusable dropdown select field with Formik integration.
 */
export const Select = (props: FieldProps) => {
  const theme = useTheme();
  const value = (props.state.value?.data as string) ?? '';
  const enableOtherOption = props.ElementProps.enableOtherOption ?? false;
  const predefinedValues = props.ElementProps.options.map(opt => opt.value);

  const {hasOtherSelected, otherText, handleOtherTextChange} = useOtherOption({
    enableOtherOption,
    rawValue: value,
    predefinedValues,
    setFieldData: props.setFieldData,
  });

  const displayValue = hasOtherSelected ? OTHER_MARKER : value;

  const onChange = (event: SelectChangeEvent) => {
    const selected = event.target.value;

    if (selected === OTHER_MARKER) {
      // Store empty "Other: " so Zod can validate it
      props.setFieldData(OTHER_PREFIX);
    } else {
      props.setFieldData(selected);
    }
  };

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <FormControl
        sx={{
          width: '100%',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <MuiSelect
          onChange={onChange}
          value={displayValue}
          input={<OutlinedInput />}
          disabled={props.disabled}
          onBlur={props.handleBlur}
        >
          {props.ElementProps.options.map((option: any) => (
            <MenuItem
              key={option.key ? option.key : option.value}
              value={option.value}
              sx={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
              }}
            >
              <ListItemText
                primary={
                  <span
                    style={{
                      display: 'contents',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      lineHeight: '0.1rem',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: contentToSanitizedHtml(option.label),
                    }}
                  />
                }
              />
            </MenuItem>
          ))}
          {/*  Other option inline text field */}
          {enableOtherOption && (
            <MenuItem
              value={OTHER_MARKER}
              sx={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                display: 'block',
                padding: '8px 16px',
              }}
              onKeyDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <TextField
                size="small"
                placeholder="Other"
                value={otherText}
                onChange={e => {
                  e.stopPropagation();
                  handleOtherTextChange(e.target.value);
                }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                disabled={props.disabled}
                variant="standard"
                multiline
                fullWidth
                sx={{
                  ...otherTextFieldSx,
                  '& .MuiInput-input': {
                    ...((otherTextFieldSx as any)['& .MuiInput-input'] || {}),
                    padding: '4px 0',
                  },
                }}
              />
            </MenuItem>
          )}
        </MuiSelect>
      </FormControl>
    </FieldWrapper>
  );
};

// Export a constant with the information required to
// register this field type
export const selectFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'Select',
  returns: 'faims-core::String',
  component: Select,
  fieldPropsSchema: SelectFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
