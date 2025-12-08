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
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {z} from 'zod';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import {contentToSanitizedHtml} from '../RichText/DomPurifier';
import FieldWrapper from '../wrappers/FieldWrapper';

const SelectFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
        key: z.string().optional(),
      })
    ),
  }),
  select_others: z.string().optional(),
});
type SelectFieldProps = z.infer<typeof SelectFieldPropsSchema>;

const valueSchema = (props: SelectFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);

  if (optionValues.length === 0) {
    return z.never();
  }

  if (optionValues.length === 1) {
    return z.literal(optionValues[0]);
  }

  // z.union requires a tuple with at least 2 elements
  return z.enum(optionValues as [string, ...string[]]);
};

type FieldProps = SelectFieldProps & FullFieldProps;

/**
 * Select Component - A reusable dropdown select field with Formik integration.
 */
export const Select = (props: FieldProps) => {
  const theme = useTheme();
  const value = (props.state.value?.data as string) ?? '';

  const onChange = (event: SelectChangeEvent) => {
    props.setFieldData(event.target.value);
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
          value={value}
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
