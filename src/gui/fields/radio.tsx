/*
 * Copyright 2021 Macquarie University
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
 * Filename: radio.tsx
 * Description:
 *   TODO
 */

import React, {useState} from 'react';
import MuiRadioGroup from '@material-ui/core/RadioGroup';
import MuiRadio, {RadioProps} from '@material-ui/core/Radio';
import FormControl from '@material-ui/core/FormControl';
import {
  FormLabel,
  FormControlLabel,
  FormHelperText,
  FormLabelProps,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@material-ui/core';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-material-ui';
import {UI_SPECIFICATION_NAME} from '../../datamodel/database';
import BookmarksIcon from '@material-ui/icons/Bookmarks';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
import {
  Defaultcomponentsetting,
  getDefaultuiSetting,
} from './BasicFieldSettings';
interface option {
  key?: string;
  value: string;
  label: string;
  FormControlProps?: Omit<
    FormControlLabelProps,
    'control' | 'value' | 'key' | 'label'
  >;
  RadioProps: RadioProps;
}

interface ElementProps {
  options: Array<option>;
}

interface Props {
  FormLabelProps: FormLabelProps;
  FormHelperTextProps: FormHelperTextProps;
  ElementProps: ElementProps;
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  render() {
    const {
      ElementProps,
      FormLabelProps,
      FormHelperTextProps,

      ...radioGroupProps
    } = this.props;

    let error = false;
    if (
      radioGroupProps.form.errors[radioGroupProps.field.name] &&
      radioGroupProps.form.touched[radioGroupProps.field.name]
    ) {
      error = true;
    }

    return (
      <FormControl error={error}>
        <FormLabel {...FormLabelProps} />
        <MuiRadioGroup {...fieldToRadioGroup(radioGroupProps)}>
          {ElementProps.options.map(option => (
            <FormControlLabel
              key={option.key ? option.key : option.value}
              value={option.value}
              control={<MuiRadio {...option['RadioProps']} />}
              label={option.label}
              {...option['FormControlProps']}
            />
          ))}
        </MuiRadioGroup>
        {error ? (
          <FormHelperText
            children={radioGroupProps.form.errors[radioGroupProps.field.name]}
          />
        ) : (
          <FormHelperText {...FormHelperTextProps} />
        )}
      </FormControl>
    );
  }
}

export function Radiocomponentsetting(props: componenentSettingprops) {
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
            RadioProps: {
              id: 'radio-group-field-' + index,
            },
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
  'component-name': 'RadioGroup',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  meta: {
    annotation_label: 'annotation',
    uncertainty: {
      include: false,
      label: 'uncertainty',
    },
  },
  'component-parameters': {
    name: 'radio-group-field',
    id: 'radio-group-field',
    variant: 'outlined',
    required: false,
    ElementProps: {
      options: [
        {
          value: '1',
          label: '1',
          RadioProps: {
            id: 'radio-group-field-1',
          },
        },
      ],
    },
    FormLabelProps: {
      children: 'Pick a number',
    },
    FormHelperTextProps: {
      children: 'Make sure you choose the right one!',
    },
  },
  validationSchema: [['yup.string']],
  initialValue: '1',
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['fields']['settingchoose'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'Choose a field from the dropdown',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: 'USD',
            label: 'USD',
          },
        ],
      },
      InputLabelProps: {
        label: 'Field',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: 'USD',
  };
  newuiSetting['views']['FormParamater']['fields'] = [
    ...newuiSetting['views']['FormParamater']['fields'],
    'settingchoose',
  ];
  newuiSetting['viewsets'] = {
    settings: {
      views: ['InputLabelProps', 'FormParamater', 'ElementProps'],
      label: 'settings',
    },
  };
  return newuiSetting;
};

export function getRadioBuilderIcon() {
  return <BookmarksIcon />;
}
export const RadioSetting = [uiSetting(), uiSpec];
