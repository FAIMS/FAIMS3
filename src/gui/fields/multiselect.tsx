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

import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-mui';
import {MenuItem} from '@mui/material';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import {
  DefaultComponentSetting,
  getDefaultuiSetting,
} from './BasicFieldSettings';
import {option} from '../../datamodel/typesystem';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';

interface ElementProps {
  options: Array<option>;
}

interface Props {
  ElementProps: ElementProps;
  select_others?: string;
}

export class MultiSelect extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    return (
      <>
        <MuiTextField
          {...fieldToTextField(textFieldProps)}
          select={true}
          SelectProps={{
            multiple: true,
          }}
        >
          {children}
          {ElementProps.options.map((option: any) => (
            <MenuItem
              key={option.key ? option.key : option.value}
              value={option.value}
            >
              {option.label}
            </MenuItem>
          ))}
        </MuiTextField>
      </>
    );
  }
}

export function MultiSelectcomponentsetting(props: componenentSettingprops) {
  const {handlerchangewithview, ...others} = props;

  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    console.log(event);
  };

  const handlerchangewithviewSpec = (event: FAIMSEVENTTYPE, view: string) => {
    //any actions that could in this form
    handlerchangewithview(event, view);

    if (
      view === 'ElementProps' &&
      event.target.name.replace(props.fieldName, '') === 'options'
    ) {
      const newvalues = props.uiSpec;
      const options: Array<option> = [];
      event.target.value.split(',').map(
        (o: string, index: number) =>
          (options[index] = {
            value: o,
            label: o,
          })
      );
      newvalues['fields'][props.fieldName]['component-parameters'][
        'ElementProps'
      ]['options'] = options;
      props.setuiSpec({...newvalues});
    }

    if (
      view === 'FormParamater' &&
      event.target.name.replace(props.fieldName, '') === 'select_others'
    ) {
      const newvalues = props.uiSpec;
      let isothers = false;
      let options: Array<option> =
        newvalues['fields'][props.fieldName]['component-parameters'][
          'ElementProps'
        ]['options'];

      options.map((o: option) =>
        o.value === 'Others' ? (isothers = true) : o
      );
      if (event.target.value === 'no') {
        options = options.filter((o: option) => o.value !== 'Others');
      } else {
        if (isothers === false) {
          options = [
            ...options,
            {
              value: 'Others',
              label: 'Others',
            },
          ];
        }
      }

      newvalues['fields'][props.fieldName]['component-parameters'][
        'ElementProps'
      ]['options'] = options;
      props.setuiSpec({...newvalues});
    }
  };

  return (
    <DefaultComponentSetting
      handlerchangewithview={handlerchangewithviewSpec}
      handlerchanges={handlerchanges}
      {...others}
      fieldui={props.fieldui}
    />
  );
}

const uiSpec = {
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

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['views']['FormParamater']['fields'] = ['helperText'];
  newuiSetting['fields']['options']['component-parameters']['helperText'] =
    'Add more than 2 options here, use "," to separate option';
  newuiSetting['viewsets'] = {
    settings: {
      views: ['InputLabelProps', 'FormParamater', 'ElementProps'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export function getSelectBuilderIcon() {
  return <BookmarksIcon />;
}

export const MultiSelectSetting = [uiSetting(), uiSpec];
