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
 * Filename: MapFormField.ts
 * Description:
 *   Provides the config interface for the map form field from @faims-project/faims3-map-input
 */

import {MapFormField} from './maps/MapFormField';
import {Typography} from '@mui/material';
import React from 'react';
import {ProjectUIFields} from 'faims3-datamodel';
import {
  componenentSettingprops,
  FAIMSEVENTTYPE,
  ProjectUIModel,
} from 'faims3-datamodel';
import {getProjectMetadata} from '../../projectMetadata';
import {getComponentFromField} from '../components/project/FormElement';
import {getDefaultuiSetting} from './BasicFieldSettings';

const GEOTIFF_DEFAULT = '';

const MapFieldUISpec = {
  'component-namespace': 'mapping-plugin', // this says what web component to use to render/acquire value from
  'component-name': 'MapFormField',
  'type-returned': 'faims-core::JSON', // matches a type in the Project Model
  'component-parameters': {
    name: 'radio-group-field',
    id: 'radio-group-field',
    variant: 'outlined',
    required: false,
    featureType: 'Point',
    zoom: 12,
    label: '',
    geoTiff: '',
    FormLabelProps: {
      children: '',
    },
  },
  validationSchema: [['yup.string']],
  initialValue: '1',
};

const MapFieldUISetting = (defaultSetting: ProjectUIModel) => {
  const newuiSetting = Object.assign({}, defaultSetting);

  newuiSetting['fields']['featureType'] = {
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      required: true,
      select: true,
      defaultValue: 'Point',
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: 'Point',
            label: 'Point',
          },
          {
            value: 'Polygon',
            label: 'Polygon',
          },
          {
            value: 'LineString',
            label: 'LineString',
          },
        ],
      },
      InputLabelProps: {
        label: 'Select Feature Type',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: 'Point',
  };

  newuiSetting['fields']['zoom'] = {
    'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
    'component-name': 'TextField',
    'type-returned': 'faims-core::Integer', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'Zoom Level',
      required: false,
      InputProps: {
        type: 'number', // must be a valid html type
      },
      SelectProps: {},
      FormHelperTextProps: {},
    },
    validationSchema: [['yup.string']],
    initialValue: 12,
  };

  newuiSetting['fields']['geoTiff'] = {
    'component-namespace': 'faims-custom',
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // should this be File???
    'component-parameters': {
      fullWidth: true,
      helperText: '',
      variant: 'outlined',
      defaultValue: GEOTIFF_DEFAULT,
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: GEOTIFF_DEFAULT,
            label: 'Use Default Basemap',
          },
        ],
      },
      InputLabelProps: {
        label: 'Select Basemap File',
      },
    },
    validationSchema: [['yup.string']],
    initialValue: GEOTIFF_DEFAULT,
  };

  newuiSetting['views']['FormParamater']['fields'] = [
    'label',
    'featureType',
    'zoom',
    'geoTiff',
  ];

  newuiSetting['viewsets'] = {
    settings: {
      views: ['FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

const baseMapCache: {[key: string]: string} = {};

const addFileAttachmentSelect = (
  project_id: string,
  newuiSetting: ProjectUIModel
) => {
  // add any attached files to the select list for basemap
  // first need to work out the fieldname which is 'geoTiff12345'
  const fields = Object.keys(newuiSetting.fields);
  let fieldname = '';
  fields.forEach(f => {
    if (f.startsWith('geoTiff')) {
      fieldname = f;
    }
  });
  return getProjectMetadata(project_id, 'attachments')
    .then(attachments => {
      const options = [
        {
          value: GEOTIFF_DEFAULT,
          label: 'Use Default Basemap',
        },
      ];

      attachments.map((file: File) => {
        let url;
        if (file.name in baseMapCache) {
          url = baseMapCache[file.name];
        } else {
          url = URL.createObjectURL(file);
          baseMapCache[file.name] = url;
        }
        const option = {
          value: url,
          label: file.name,
        };
        options.push(option);
      });
      newuiSetting['fields'][fieldname][
        'component-parameters'
      ].ElementProps.options = options;
      return newuiSetting;
    })
    .catch(() => {
      // most likely there is no project metadata and so we just
      // return the unmodified settings
      return newuiSetting;
    });
};

const MapFieldBuilderSettings = [
  MapFieldUISetting(getDefaultuiSetting()),
  MapFieldUISpec,
];

const getfieldNamesbyView = (
  uiSetting: ProjectUIModel,
  view: string,
  fieldui: ProjectUIFields
) => {
  if (
    [
      'meta',
      'validationSchema',
      'access',
      'FormParamater',
      'other',
      'logic',
    ].includes(view)
  )
    return uiSetting['views'][view]['fields'] ?? [];
  if (
    uiSetting['views'][view] !== undefined &&
    fieldui['component-parameters'][view] !== undefined
  )
    return uiSetting['views'][view]['fields'];
  return [];
};

// MapComponentSetting is a React component for input of the config
// settings for the MapField
//
const MapComponentSetting = (props: componenentSettingprops) => {
  const [uiSetting, setuiSetting] = React.useState(props.uiSetting);

  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    if (props.handlerchanges !== undefined) {
      props.handlerchanges(event);
    }
  };

  const handlerchangewithview = (event: FAIMSEVENTTYPE, view: string) => {
    props.handlerchangewithview(event, view);
    handlerchanges(event);
  };

  const getfield = (
    fieldName: string,
    uiSetting: any,
    formProps: any,
    handlerchangewithview: any,
    view: string
  ) => {
    return (
      <div key={'key' + fieldName}>
        {getComponentFromField(
          uiSetting,
          fieldName,
          props.formProps,
          (event: FAIMSEVENTTYPE) => {
            handlerchangewithview(event, view);
          }
        )}
        {'   '}
        <Typography style={{color: 'red'}} variant="caption">
          {formProps.errors[fieldName] !== undefined &&
            formProps.errors[fieldName].replace(fieldName, '  It ')}
        </Typography>
      </div>
    );
  };

  addFileAttachmentSelect(props.projectvalue.project_id, props.uiSetting).then(
    settings => {
      setuiSetting(settings);
    }
  );

  return (
    <div>
      {uiSetting['viewsets'][props.designvalue]['views'] !== undefined &&
      uiSetting['viewsets'][props.designvalue]['views'].length === 0
        ? ''
        : uiSetting['viewsets'][props.designvalue]['views'].map((view: any) =>
            getfieldNamesbyView(uiSetting, view, props.fieldui).map(
              (fieldName: string) =>
                getfield(
                  fieldName,
                  uiSetting,
                  props.formProps,
                  handlerchangewithview,
                  view
                )
            )
          )}
    </div>
  );
};

export {MapFormField, MapFieldBuilderSettings, MapComponentSetting};
