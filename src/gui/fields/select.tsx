/*
 * Copyright 2021,2022 Macquarie University
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
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import {MenuItem} from '@material-ui/core';
import BookmarksIcon from '@material-ui/icons/Bookmarks';
import {
  Defaultcomponentsetting,
  getDefaultuiSetting,
} from './BasicFieldSettings';
import {option} from '../../datamodel/typesystem';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
/* eslint-disable @typescript-eslint/no-unused-vars */
// interface option {
//   key: string;
//   value: string;
//   label: string;
// }

interface ElementProps {
  options: Array<option>;
}

interface Props {
  ElementProps: ElementProps;
}

export class Select extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    return (
      <MuiTextField {...fieldToTextField(textFieldProps)} select={true}>
        {children}
        {ElementProps.options.map(option => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
          >
            {option.label}
          </MenuItem>
        ))}
      </MuiTextField>
    );
  }
}

export function Selectcomponentsetting(props: componenentSettingprops) {
  const {handlerchangewithview, ...others} = props;

  const handlerchanges = (event: FAIMSEVENTTYPE) => {};

  const handlerchangewithviewSpec = (event: FAIMSEVENTTYPE, view: string) => {
    //any actions that could in this form
    props.handlerchangewithview(event, view);

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
  };

  return (
    <Defaultcomponentsetting
      handlerchangewithview={handlerchangewithviewSpec}
      handlerchanges={handlerchanges}
      {...others}
      fieldui={props.fieldui}
    />
  );
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'Select',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'Choose a field from the dropdown',
    variant: 'outlined',
    required: false,
    select: true,
    InputProps: {},
    SelectProps: {},
    ElementProps: {
      options: [],
    },
    InputLabelProps: {
      label: 'Select Field',
    },
  },
  validationSchema: [['yup.string']],
  initialValue: '',
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
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

export const SelectSetting = [uiSetting(), uiSpec];
