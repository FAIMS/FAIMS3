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
 * Filename: RelatedRecordSelector.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Link as RouterLink} from 'react-router-dom';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import TextField from '@material-ui/core/TextField';

import {Field, FieldProps} from 'formik';
import {
  Autocomplete,
  AutocompleteRenderInputParams,
} from 'formik-material-ui-lab';

import * as ROUTES from '../../constants/routes';
import {FAIMSTypeName} from '../../datamodel/core';
import {RecordReference} from '../../datamodel/ui';
import {getAllRecordsOfType} from '../../data_storage/queries';
import {
  getDefaultuiSetting,
  Defaultcomponentsetting,
} from './BasicFieldSettings';
import LibraryBooksIcon from '@material-ui/icons/Bookmarks';
import {option} from '../../datamodel/typesystem';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
interface Props {
  related_type: FAIMSTypeName;
  relation_type: FAIMSTypeName;
}

export function RelatedRecordSelector(props: FieldProps & Props) {
  const project_id = props.form.values['_project_id'];
  const field_name = props.field.name;
  const [options, setOptions] = React.useState<RecordReference[]>([]);

  React.useEffect(() => {
    (async () => {
      const records = await getAllRecordsOfType(project_id, props.related_type);
      setOptions(records);
    })();
  }, []);

  // Note the "multiple" option below, that seems to control whether multiple
  // entries can in entered.
  // TODO: Have the relation_type set the multiplicity of the system
  return (
    <div>
      <Field
        id="asynchronous-demo"
        name={field_name}
        component={Autocomplete}
        getOptionSelected={(option: RecordReference, value: RecordReference) =>
          option.project_id === value.project_id &&
          option.record_id === value.record_id
        }
        getOptionLabel={(option: RecordReference) => option.record_label}
        options={options}
        renderInput={(params: any) => (
          <TextField
            {...params}
            label="Select Record "
            variant="outlined"
            InputProps={{
              ...params.InputProps,
            }}
          />
        )}
      />
      {project_id !== undefined && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          component={RouterLink}
          to={
            ROUTES.PROJECT +
            project_id +
            ROUTES.RECORD_CREATE +
            props.related_type
          }
        >
          New Record
        </Button>
      )}
    </div>
  );
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'RelatedRecordSelector',
  'type-returned': 'faims-core::Relationship', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'Select a Form or Field',
    variant: 'outlined',
    required: true,
    related_type: '',
    relation_type: 'faims-core::Child',
    InputProps: {
      type: 'text', // must be a valid html type
    },
    SelectProps: {},
    InputLabelProps: {
      label: 'Related Field',
    },
    FormHelperTextProps: {},
  },
  validationSchema: [['yup.string'], ['yup.required']],
  initialValue: '',
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  // console.log(generatenewfield('faims-custom','Select',null,null,null))
  // newuiSetting['fields']['related_type']=
  // newuiSetting['fields']['relation_type']=generatenewfield('faims-custom','Select',null,'related_type',null)
  // newuiSetting['fields']['relation_type']['component-parameters']['ElementProps']=[{
  //   value: 'faims-core::Child',
  //   label: 'Contained',
  // }]
  newuiSetting['fields']['related_type'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'stringield',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [],
      },
      InputLabelProps: {
        label: 'Select Form or Field',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: '',
  };
  newuiSetting['fields']['relation_type'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'stringield',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: 'faims-core::Child',
            label: 'Contained',
          },
          {
            value: 'faims-core::Linked',
            label: 'Linked',
          },
        ],
      },
      InputLabelProps: {
        label: 'Select Relation Type',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: 'faims-core::Child',
  };
  newuiSetting['views']['FormParamater']['fields'] = [
    'relation_type',
    'related_type',
  ];
  newuiSetting['viewsets'] = {
    settings: {
      views: ['InputLabelProps', 'FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export function getLinkedBuilderIcon() {
  return <LibraryBooksIcon />;
}

export const LinkedSetting = [uiSetting(), uiSpec];

export function Linkedcomponentsetting(props: componenentSettingprops) {
  const [uiSetting, setuiSetting] = React.useState(props.uiSetting);

  React.useEffect(() => {
    setini();
  }, [props.uiSpec['visible_types']]);

  const setrelatedtype = (fields: Array<string>) => {
    if (fields.length > 0) {
      //get numbers of fields that not IDs
      const newvalues = uiSetting;
      const options: Array<option> = [];
      fields.map(
        (field: string, index: number) =>
          (options[index] = {
            value: field,
            label: field,
          })
      );
      if (newvalues['fields']['related_type' + props.fieldName] !== undefined)
        newvalues['fields']['related_type' + props.fieldName][
          'component-parameters'
        ]['ElementProps']['options'] = options;

      setuiSetting({...newvalues});
    }
  };

  const setini = () => {
    const options: Array<option> = [];
    //TODO pass the value of all field in this form
    const fields: Array<string> = props.uiSpec['visible_types'];
    //fields=fields.filter((type:string)=>type!==props.currentform)
    setrelatedtype(fields);
  };

  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    // if(event.target.name.replace(props.fieldName,'')==='relation_type'){
    //   if(event.target.value==='faims-core::Field'){
    //     //get fields for select
    //     let fields:Array<string>=[]
    //     props.uiSpec['viewsets'][props.currentform]['views'].map((view:string)=>fields=[...fields,...props.uiSpec['views'][view]['fields']])
    //     fields=fields.filter((field:string)=>field!==props.fieldName)
    //     setrelatedtype(fields)
    //   }
    // }
  };

  return (
    <Defaultcomponentsetting
      handlerchanges={handlerchanges}
      {...props}
      fieldui={props.fieldui}
      uiSetting={uiSetting}
    />
  );
}
