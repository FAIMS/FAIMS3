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
 * Filename: TemplatedStringField.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiTextField from '@mui/material/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-mui';
import Mustache from 'mustache';
import {
  Defaultcomponentsetting,
  getDefaultuiSetting,
} from './BasicFieldSettings';
import {generatenewfield} from '../components/project/data/componenentSetting';
import LibraryBooksIcon from '@mui/icons-material/Bookmarks';
import {option} from '../../datamodel/typesystem';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
import {HRID_STRING} from '../../datamodel/core';

/* eslint-disable @typescript-eslint/no-unused-vars */
interface FieldValues {
  [field_name: string]: any;
}

function render_template(template: string, values: FieldValues): string {
  return Mustache.render(template, values);
}

interface Props {
  template: string;
}

interface State {
  value: string;
}

export class TemplatedStringField extends React.Component<
  TextFieldProps & Props,
  State
> {
  constructor(props: TextFieldProps & Props) {
    super(props);
    this.state = {
      value: '',
    };
  }

  componentDidUpdate() {
    const {template, ...textFieldProps} = this.props;

    const field_values: FieldValues = {};
    for (const field_name in textFieldProps.form.values) {
      if (field_name !== textFieldProps.field.name) {
        field_values[field_name] = textFieldProps.form.values[field_name];
      }
    }
    const value = render_template(template, field_values);
    if (value !== this.state.value) {
      this.setState({value: value});
      this.props.form.setFieldValue(this.props.field.name, value);
    }
  }

  render() {
    const {children, ...textFieldProps} = this.props;

    const text_props = fieldToTextField(textFieldProps);
    if (text_props.InputProps === undefined) {
      text_props.InputProps = {};
    }
    text_props.InputProps.readOnly = true;

    return (
      <>
        <MuiTextField {...text_props}>{children}</MuiTextField>
        <br />
        <br />
      </>
    );
  }
}

export function TemplatedStringcomponentsetting(
  props: componenentSettingprops
) {
  const [uiSetting, setuiSetting] = React.useState(props.uiSetting);

  React.useEffect(() => {
    setini();
  }, [props.uiSpec['views']]);

  const changeui = (
    options: Array<option>,
    newvalues: ProjectUIModel,
    fieldnum: number,
    isinit: boolean
  ) => {
    const newfieldlist: Array<string> = [];
    let value: any = 'αβγ ';
    const newini = props.initialValues;
    const templatevalue =
      props.uiSpec['fields'][props.fieldName]['component-parameters'][
        'template'
      ];
    for (let i = 0; i < fieldnum; i++) {
      //get all list field for the uiSpeting
      const name = 'fieldselect' + 1 + i + props.fieldName;
      const newfield = generatenewfield(
        'faims-custom',
        'Select',
        null,
        name,
        null
      );
      newfield['component-parameters']['ElementProps']['options'] = options;
      newfield['component-parameters']['required'] = true;
      newfield['validationSchema'] = [
        ['yup.string'],
        ['yup.required'],
        ['yup.min', 1],
      ];
      let inivalue = templatevalue.split('-');
      inivalue =
        inivalue.length > 0 && inivalue[i] !== undefined
          ? inivalue[i].replace(/{{|}}|-|αβγ /gi, '')
          : '';
      newfield['initialValue'] = inivalue;
      newvalues['fields'][name] = newfield;
      newini[name] = inivalue;
      newfieldlist[i] = name;
      value = value + '{{' + name + '}}-';
    }
    value = value.substring(0, value.length - 1);
    newvalues['views']['FormParamater']['fields'] = [
      'hrid' + props.fieldName,
      'helperText' + props.fieldName,
      'numberfield' + props.fieldName,
      ...newfieldlist,
      'template' + props.fieldName,
    ];
    newvalues['fields']['template' + props.fieldName]['value'] = isinit
      ? templatevalue
      : value;
    newini['numberfield' + props.fieldName] = fieldnum;
    newini['label' + props.fieldName] =
      props.uiSpec['fields'][props.fieldName]['component-parameters'][
        'InputLabelProps'
      ]['label'];
    // newini['template'+props.fieldName]=isinit?templatevalue:value
    console.log(newini);
    props.setinitialValues({...props.initialValues, ...newini});
    return newvalues;
  };

  const setini = () => {
    const options: Array<option> = [];
    //TODO pass the value of all field in this form

    // let fields: Array<string> = [];
    props.uiSpec['viewsets'][props.currentform]['views'].map((view: string) => {
      props.uiSpec['views'][view]['fields'].map((field: string) =>
        props.uiSpec['fields'][field]['component-name'] !==
        'TemplatedStringField'
          ? options.push({
              value: field,
              label:
                props.uiSpec['fields'][field]['component-name'] + ' - ' + field,
            })
          : field
      );
    });

    if (
      props.projectvalue.meta !== undefined &&
      props.projectvalue.meta !== null
    ) {
      for (const [key, value] of Object.entries(props.projectvalue.meta)) {
        options.push({
          value: props.projectvalue.meta[key],
          label: key + ' - ' + props.projectvalue.meta[key],
        });
      }
    }
    console.log(options);
    if (options.length > 0) {
      //get numbers of fields that not IDs

      const numoptions: any = [];
      options.map(
        (option: option, index: number) =>
          (numoptions[index] = {
            value: index + 1,
            label: index + 1,
          })
      );
      let newvalues: ProjectUIModel = uiSetting;
      if (newvalues['fields']['numberfield' + props.fieldName] !== undefined)
        newvalues['fields']['numberfield' + props.fieldName][
          'component-parameters'
        ]['ElementProps']['options'] = numoptions;
      let farray: Array<string> = props.uiSpec['fields'][props.fieldName][
        'component-parameters'
      ]['template'].split('-');
      farray = farray.filter((f: string) => f !== '');
      const num = farray.length > 1 ? farray.length : 1;
      newvalues = changeui(options, newvalues, num, true);
      setuiSetting({...newvalues});
    }

    if (
      props.uiSpec['fields'][props.fieldName]['component-parameters'][
        'hrid'
      ] === true
    ) {
      setuphrid();
    }
  };

  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    const name = event.target.name.replace(props.fieldName, '');
    if (name === 'numberfield') {
      const options: Array<option> = [];
      //TODO pass the value of all field in this form

      // let fields: Array<string> = [];
      props.uiSpec['viewsets'][props.currentform]['views'].map(
        (view: string) => {
          props.uiSpec['views'][view]['fields'].map((field: string) =>
            props.uiSpec['fields'][field]['component-name'] !==
            'TemplatedStringField'
              ? options.push({
                  value: field,
                  label:
                    props.uiSpec['fields'][field]['component-name'] +
                    ' - ' +
                    field,
                })
              : field
          );
        }
      );

      if (
        props.projectvalue.meta !== undefined &&
        props.projectvalue.meta !== null
      ) {
        for (const [key, value] of Object.entries(props.projectvalue.meta)) {
          options.push({
            value: props.projectvalue.meta[key],
            label: key + ' - ' + props.projectvalue.meta[key],
          });
        }
      }

      if (options.length > 0) {
        //get numbers of fields that not IDs
        let newuis: ProjectUIModel = uiSetting;
        newuis = changeui(options, newuis, event.target.value, false);

        const newuiSpec = props.uiSpec;
        newuiSpec['fields'][props.fieldName]['component-parameters'][
          'template'
        ] = newuis['fields']['template' + props.fieldName]['value'];
        props.setuiSpec({...newuiSpec});
        console.log(newuiSpec);

        setuiSetting({...newuis});
      }
    }

    if (name.includes('fieldselect1')) {
      let targetvalue = event.target.value;
      if (event.target.value === '' || event.target.value === undefined) {
        targetvalue = ' ';
      }

      const newvalues = props.uiSpec;
      const string =
        props.uiSpec['fields'][props.fieldName]['component-parameters'][
          'template'
        ] + '-';
      const value = string.split('-');
      console.log(value);
      const num = name.replace('fieldselect1', '');
      if (targetvalue.indexOf('newfield') !== -1)
        value[num] = '{{' + event.target.value + '}}';
      else value[num] = event.target.value;
      const subvalue = value.join('-');
      // if (!subvalue.includes('αβγ ')) subvalue = 'αβγ ' + subvalue;
      newvalues['fields'][props.fieldName]['component-parameters'][
        'template'
      ] = subvalue.substring(0, subvalue.length - 1);

      props.setuiSpec({...newvalues});

      const newuis = uiSetting;
      newuis['fields']['template' + props.fieldName]['value'] = subvalue;

      setuiSetting({...newuis});
    }

    if (name === 'hrid') {
      console.log('Change target name: ' + event.target.checked);
      if (event.target.checked === true) {
        setuphrid();
      } else {
        const newfieldname = HRID_STRING + props.currentform;
        const newui = props.uiSpec;
        newui['views'][props.currentview]['fields'] = newui['views'][
          props.currentview
        ]['fields'].map((field: string) =>
          field === newfieldname ? (field = props.fieldName) : field
        );
        newui['fields'][props.fieldName]['component-parameters']['hrid'] =
          event.target.checked;
        props.setuiSpec({...newui});
      }
    }
  };

  const setuphrid = () => {
    //check if there is hird
    let ishird = false;
    props.uiSpec['viewsets'][props.currentform]['views'].map((view: string) => {
      if (
        props.uiSpec['views'][view]['fields'].includes(
          HRID_STRING + props.currentform
        ) &&
        props.uiSpec['fields'][props.fieldName]['component-parameters'] !== true
      )
        ishird = true;
    });
    if (ishird) {
      console.log('set hird twice');
      //alert('Can ONLY set one Human Readable ID, please unckeck existing firstly')
    } else {
      //change all name to hird
      const newfieldname = HRID_STRING + props.currentform;
      const newui = props.uiSpec;
      newui['fields'][newfieldname] = JSON.parse(
        JSON.stringify(newui['fields'][props.fieldName])
      ); //change uifield name
      newui['fields'][newfieldname]['component-parameters'][
        'id'
      ] = newfieldname;
      newui['fields'][newfieldname]['component-parameters'][
        'name'
      ] = newfieldname;
      newui['fields'][newfieldname]['component-parameters']['linked'] =
        props.fieldName;
      newui['views'][props.currentview]['fields'] = newui['views'][
        props.currentview
      ]['fields'].map((field: string) =>
        field === props.fieldName ? (field = newfieldname) : field
      );
      newui['fields'][props.fieldName]['component-parameters']['hrid'] = true;
      console.log(newui);
      props.setuiSpec({...newui});
    }
  };

  return (
    <>
      <Defaultcomponentsetting
        handlerchanges={handlerchanges}
        {...props}
        fieldui={props.fieldui}
        uiSetting={uiSetting}
      />
      Template:
      {
        props.uiSpec['fields'][props.fieldName]['component-parameters'][
          'template'
        ]
      }
    </>
  );
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'TemplatedStringField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'hrid-field',
    id: 'hrid-field',
    helperText: 'Human Readable ID',
    variant: 'outlined',
    required: true,
    template: ' {{}}',
    InputProps: {
      type: 'text', // must be a valid html type
    },
    InputLabelProps: {
      label: 'Human Readable ID',
    },
    hrid: true,
  },
  validationSchema: [['yup.string'], ['yup.required']],
  initialValue: '',
};

function UISetting() {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();

  newuiSetting['fields']['numberfield'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText:
        'Select number of Component for This ID field,please enaure to add BasicAutoIncrementer Component. And then select field or meta value from following dropdown list',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: '0',
            label: '0',
          },
        ],
      },
      InputLabelProps: {
        label: 'Number of Field',
      },
    },
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: '1',
  };
  newuiSetting['fields']['template'] = {
    'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
    'component-name': 'TextField',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      required: false,
      InputProps: {
        type: 'hidden', // must be a valid html type
      },
      SelectProps: {},
      // InputLabelProps: {
      //   label: '',
      // },
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  };

  newuiSetting['fields']['hrid'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Checkbox',
    'type-returned': 'faims-core::Bool', // matches a type in the Project Model
    'component-parameters': {
      required: false,
      type: 'checkbox',
      FormControlLabelProps: {
        label: 'Choose as Unique Human Readable ID',
      },
      FormHelperTextProps: {
        children:
          'Tick if choose as Human Readable ID, each Form can only set one Human Readable ID, if set multiple, only first one will be taken',
      },
    },
    validationSchema: [['yup.bool']],
    initialValue: false,
  };

  newuiSetting['views']['FormParamater']['fields'] = [
    'hrid',
    'helperText',
    'numberfield',
    'template',
  ];
  newuiSetting['viewsets'] = {
    settings: {
      views: ['InputLabelProps', 'FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
}

export function getTemplatedStringBuilderIcon() {
  return <LibraryBooksIcon />;
}

export const TemplatedStringSetting = [UISetting(), uiSpec];
