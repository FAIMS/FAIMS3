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
 * Filename: RelatedRecordSelector.tsx
 * Description:
 *   TODO
 */

import React, {useEffect} from 'react';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';

import {Field, FieldProps} from 'formik';
import {Autocomplete} from 'formik-mui';

import * as ROUTES from '../../constants/routes';
import {FAIMSTypeName, LocationState} from '../../datamodel/core';
import {RecordReference} from '../../datamodel/ui';
import {getRecordsByType} from '../../data_storage';
import {
  getDefaultuiSetting,
  Defaultcomponentsetting,
} from './BasicFieldSettings';
import LibraryBooksIcon from '@mui/icons-material/Bookmarks';
import {option} from '../../datamodel/typesystem';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
import {useLocation, Link} from 'react-router-dom';
import {Typography} from '@mui/material';
import {get_RelatedFields_for_field} from '../components/record/relationships/RelatedInfomation';
import {DataGrid, GridColDef} from '@mui/x-data-grid';
/* eslint-disable @typescript-eslint/no-unused-vars */
interface Props {
  related_type: FAIMSTypeName;
  relation_type: FAIMSTypeName;
  multiple?: boolean;
  id: string;
  InputLabelProps: {label: string};
  required: boolean;
  helperText?: string;
  disabled?: boolean;
  relation_linked_vocabPair?:Array<string>;
}

export function RelatedRecordSelector(props: FieldProps & Props) {
  const project_id = props.form.values['_project_id'];
  const field_name = props.field.name;
  const [options, setOptions] = React.useState<RecordReference[]>([]);
  const multiple =
    options.length > 0 && props.multiple !== undefined ? props.multiple : false;
  const location = useLocation();
  let search = location.search.includes('link=')
    ? location.search.replace('?', '')
    : '';
  const [isactive, setIsactive] = React.useState(false);
  const [recordsInformation, setRecordsInformation] = React.useState<
    Array<{[field_name: string]: any}>
  >([]);

  const url_split = search.split('&');
  const [columns, Setcolumns] = React.useState<GridColDef[]>([]);
  if (
    url_split.length > 1 &&
    url_split[0].replace('field_id=', '') === props.id
  )
    search = search.replace(url_split[0] + '&' + url_split[1], '');
  if (search !== '') search = '&' + search;

  useEffect(() => {
    if (project_id !== undefined) {
      (async () => {
        const records = await getRecordsByType(project_id, props.related_type,props.relation_type,props.relation_linked_vocabPair);
        setOptions(records);
        setIsactive(true);
      })();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (project_id !== undefined && mounted) {
        const records_info = await get_RelatedFields_for_field(
          project_id,
          props.field.name,
          props.form.values
        );
        setRecordsInformation(records_info);
        const newColumns: GridColDef[] = [];
        if (records_info.length > 0 && columns.length === 0) {
          Object.keys(records_info[0]).map((key: string) =>
            ['id', 'children', 'route', 'type'].includes(key)
              ? key
              : newColumns.push({
                  field: key,
                  flex: 0.2,
                  minWidth: 100,
                })
          );
          Setcolumns(newColumns);
        }
      }
    })();

    return () => {
      // executed when unmount
      mounted = false;
    };
  }, [props.form.values[props.field.name]]);

  // Note the "multiple" option below, that seems to control whether multiple
  // entries can in entered.
  // TODO: Have the relation_type set the multiplicity of the system
  if (!isactive) return <></>;
  //to reset the method to pass state value between the link and record
  //to pass information in state to child/link record
  const newState: LocationState = {
    parent_record_id: props.form.values._id, //current form record id
    field_id: props.id,
    type: props.relation_type.replace('faims-core::', ''), //type of this relation
    parent_link: location.pathname.replace('/notebooks/', ''), // current form link
    parent: {},
    relation_type_vocabPair:props.relation_linked_vocabPair //pass the value of vocalPair 
  };
  const disbaled = props.disabled ?? false;
  const location_state: any = location.state;
  if (location_state !== undefined && location_state !== null) {
    if (location_state.parent_record_id !== props.form.values._id)
      newState['parent'] = location.state;
    else if (location_state.parent !== undefined) {
      //when the record is the parent record, the record should be the one returned from child, so should get the parent infonmation
      newState['parent'] = location_state.parent;
    }
  }
  return (
    <div>
      <Field
        multiple={multiple}
        id={props.id ?? 'asynchronous-demo'}
        name={field_name}
        component={Autocomplete}
        isOptionEqualToValue={(
          option: RecordReference,
          value: RecordReference
        ) =>
          option.project_id === value.project_id &&
          option.record_id === value.record_id
        }
        getOptionLabel={(option: RecordReference) => option.record_label ?? ''}
        options={options}
        defaultValue={undefined}
        disabled={disbaled}
        // onChange={(evant:any,value: any) => {
        //   props.form.setFieldValue(props.field.name, value)
        // }}
        // value={multiple?props.form.values[props.field.name]:props.form.values[props.field.name]}
        renderInput={(params: any) => (
          <TextField
            {...params}
            label={props.InputLabelProps.label}
            error={props.form.errors[props.id] === undefined ? false : true}
            variant="outlined"
            InputProps={{
              ...params.InputProps,
            }}
          />
        )}
      />
      {project_id !== undefined &&
        disbaled === false && ( //update for eid or view
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            component={Link}
            to={{
              pathname:
                ROUTES.NOTEBOOK +
                project_id +
                ROUTES.RECORD_CREATE +
                props.related_type,
              state: newState,
              search:
                '?field_id=' + props.id + '&link=' + location.pathname + search,
            }}
          >
            New Record
          </Button>
        )}
      {disbaled === false && ( //update for eid or view
        <Typography variant="caption">{props.helperText}</Typography>
      )}
      <br />
      {recordsInformation.length > 0 && (
        <DataGrid
          autoHeight
          hideFooterSelectedRowCount
          initialState={{
            columns: {
              columnVisibilityModel: {
                // Hide column route, the other columns will remain visible
                route: false,
              },
            },
          }}
          getRowHeight={() => 'auto'}
          density={'compact'}
          rows={recordsInformation}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5]}
          disableSelectionOnClick
          // sx={{cursor: 'pointer'}}
          sx={{borderRadius: '0'}}
        />
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
    helperText: 'Select or Add new related record',
    variant: 'outlined',
    required: true,
    related_type: '',
    relation_type: 'faims-core::Child',
    InputProps: {
      type: 'text', // must be a valid html type
    },
    multiple: false,
    SelectProps: {},
    InputLabelProps: {
      label: 'Select Related',
    },
    FormHelperTextProps: {},
  },
  validationSchema: [['yup.string'], ['yup.required']],
  initialValue: '',
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['fields']['multiple'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Checkbox',
    'type-returned': 'faims-core::Bool', // matches a type in the Project Model
    'component-parameters': {
      name: 'multiple',
      id: 'multiple',
      required: false,
      type: 'checkbox',
      FormControlLabelProps: {
        label: 'Multiple',
      },
      FormHelperTextProps: {
        children: 'Tick if user can add multiple records for this relationship',
      },
    },
    validationSchema: [['yup.bool']],
    initialValue: false,
  };
  newuiSetting['fields']['relation_type'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: 'faims-core::Child',
            label: 'Child',
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
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: 'faims-core::Child',
  };
  newuiSetting['fields']['relation_linked_vocabPair_from'] = {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      InputLabelProps: {
        label: 'Number of Line',
      },
      fullWidth: false,
      helperText: '',
      variant: 'outlined',
      required: false,
    },
    validationSchema: [['yup.string']],
    initialValue: 'is related to',
  };
  newuiSetting['fields']['relation_linked_vocabPair_to'] = {
    'component-namespace': 'formik-material-ui',
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer',
    'component-parameters': {
      InputLabelProps: {
        label: 'Number of Line',
      },
      fullWidth: false,
      helperText: '',
      variant: 'outlined',
      required: false,
    },
    validationSchema: [['yup.string']],
    initialValue: 'is related to',
  };
  newuiSetting['fields']['related_type'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: ' ',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [],
      },
      InputLabelProps: {
        label: 'Select Related Form',
      },
    },
    validationSchema: [['yup.string'], ['yup.required']],
    initialValue: '',
  };

  newuiSetting['views']['FormParamater']['fields'] = [
    'helperText',
    'multiple',
    'relation_type',
    'relation_linked_vocabPair_from',
    'relation_linked_vocabPair_to',
    'related_type'
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

  useEffect(() => {
    setini();
  }, [props.uiSpec['visible_types']]);

  const setini = () => {
    const options: Array<option> = [];
    const fields: Array<option> = [];
    props.uiSpec['visible_types'].map((viewset: string) =>
      fields.push({
        label: props.uiSpec['viewsets'][viewset]['label'] ?? viewset,
        value: viewset,
      })
    );
    // get the list of form
    const newvalues = uiSetting;
    if(fields.length>0 && newvalues['fields']['related_type' + props.fieldName] !== undefined )
      newvalues['fields']['related_type' + props.fieldName]['component-parameters']['ElementProps']['options'] = fields;
    if(props.uiSpec['fields'][props.fieldName]['component-parameters']['relation_type']==='faims-core::Child') 
    newvalues['views']['FormParamater']['fields'] = [
      'helperText'+ props.fieldName,
      'multiple'+ props.fieldName,
      'relation_type'+ props.fieldName,
      'related_type'+ props.fieldName
    ]
    setuiSetting({...newvalues});
    
  };

  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    const name = event.target.name.replace(props.fieldName, '')
    if (name === 'multiple') {
      const newvalues = props.uiSpec;
      newvalues['fields'][props.fieldName]['component-parameters']['multiple'] =
        event.target.checked;
      if (event.target.checked === true)
        newvalues['fields'][props.fieldName]['initialValue'] = [];
      else newvalues['fields'][props.fieldName]['initialValue'] = '';
      props.setuiSpec({...newvalues});
    }else if(name === 'relation_type'){
      const newvalues = uiSetting;
      if(event.target.value==='faims-core::Linked')
        newvalues['views']['FormParamater']['fields'] = [
          'helperText'+ props.fieldName,
          'multiple'+ props.fieldName,
          'relation_type'+ props.fieldName,
          'relation_linked_vocabPair_from'+ props.fieldName,
          'relation_linked_vocabPair_to'+ props.fieldName,
          'related_type'+ props.fieldName,
        ]
      else
      newvalues['views']['FormParamater']['fields'] = [
        'helperText'+ props.fieldName,
        'multiple'+ props.fieldName,
        'relation_type'+ props.fieldName,
        'related_type'+ props.fieldName,
      ]
      setuiSetting({...newvalues})
      
    }else if( name === 'relation_linked_vocabPair_from'){
      const newvalues = props.uiSpec;
      const relation_linked_vocabPair = newvalues['fields'][props.fieldName]['component-parameters']['relation_linked_vocabPair']??['','']
      newvalues['fields'][props.fieldName]['component-parameters']['relation_linked_vocabPair'] = [event.target.value,relation_linked_vocabPair[1]]
      props.setuiSpec({...newvalues});
    }else if( name === 'relation_linked_vocabPair_to'){
      const newvalues = props.uiSpec;
      const relation_linked_vocabPair = newvalues['fields'][props.fieldName]['component-parameters']['relation_linked_vocabPair']??['','']
      newvalues['fields'][props.fieldName]['component-parameters']['relation_linked_vocabPair'] = [relation_linked_vocabPair[0],event.target.value]
      props.setuiSpec({...newvalues});
    }
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
