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
  Checkbox,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from '@mui/material';
import {FieldProps} from 'formik';
import {TextFieldProps} from 'formik-mui';

interface ElementProps {
  options: Array<ElementOption>;
}

interface Props {
  ElementProps: ElementProps;
  select_others?: string;
}

import {useTheme} from '@mui/material/styles';

export const MultiSelect = (props: FieldProps & Props & TextFieldProps) => {
  const theme = useTheme();
  const handleChange = (e: any) => {
    props.form.setFieldValue(props.field.name, e.target.value, true);
  };

  return (
    <FormControl sx={{m: 1, width: '100%'}}>
      <InputLabel
        id="multi-select-label"
        style={{backgroundColor: theme.palette.background.default}}
      >
        {props.label}
      </InputLabel>
      <Select
        labelId="multi-select-label"
        multiple
        label={props.label}
        onChange={handleChange}
        value={props.field.value}
        input={<OutlinedInput label={props.label} />}
        renderValue={selected => selected.join(', ')}
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
            <Checkbox checked={props.field.value.includes(option.value)} />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>
      {props.helperText && <FormHelperText>{props.helperText}</FormHelperText>}
    </FormControl>
  );
};

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'MultiSelect',
//   'type-returned': 'faims-core::Array', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     helperText: 'Choose items from the dropdown',
//     variant: 'outlined',
//     required: false,
//     select: true,
//     InputProps: {},
//     SelectProps: {
//       multiple: true,
//     },
//     ElementProps: {
//       options: [
//         {
//           value: 'Default',
//           label: 'Default',
//         },
//         {
//           value: 'Default2',
//           label: 'Default2',
//         },
//       ],
//     },
//     InputLabelProps: {
//       label: 'Select Multiple',
//     },
//   },
//   validationSchema: [['yup.array']],
//   initialValue: [],
// };
