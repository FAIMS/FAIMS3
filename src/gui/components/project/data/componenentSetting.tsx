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
 * Filename: defaults.tsx
 * Description:
 *   TODO
 */

import {getComponentPropertiesByName} from '../../../component_registry';
import {useState, useEffect} from 'react';
import {
  ProjectUIModel,
  resetprops,
  FAIMSEVENTTYPE,
  componenentSettingprops,
} from '../../../../datamodel/ui';
import {ProjectUIFields} from '../../../../datamodel/typesystem';
import {Defaultcomponentsetting} from '../../../fields/BasicFieldSettings';
import {HRID_STRING} from '../../../../datamodel/core';
/* eslint-disable @typescript-eslint/no-unused-vars */

const uiSettingOthers: ProjectUIModel = {
  fields: {
    annotation_label: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'annotation_label',
        id: 'annotation_label',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Annotation Label',
        },
        type: 'text',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: 'Annotation_label',
    },
    uncertainty_include: {
      'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool', // matches a type in the Project Model
      'component-parameters': {
        name: 'include',
        id: 'include',
        required: false,
        type: 'checkbox',
        FormControlLabelProps: {
          label: 'Include Uncertainty',
        },
        FormHelperTextProps: {
          children: 'Include Uncertainty',
        },
        // Label: {label: 'Terms and Conditions'},
      },
      validationSchema: [['yup.bool']],
      initialValue: true,
    },
    uncertainty_label: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'textInput',
        id: 'textInput',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Uncertainty Label',
        },
        type: 'text',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: 'label',
    },
    required: {
      'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool', // matches a type in the Project Model
      'component-parameters': {
        name: 'required',
        id: 'required',
        required: true,
        type: 'checkbox',
        FormControlLabelProps: {
          label: 'Select if component completion is compulsory',
        },
        FormHelperTextProps: {
          children: '',
        },
      },
      validationSchema: [['yup.bool']],
      initialValue: false,
    },
    validationSchema: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'validationSchema',
        id: 'validationSchema',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'validationSchema',
        },
        type: 'text',
        disabled: true,
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: '',
    },
  },
  views: {
    meta: {
      fields: ['annotation_label', 'uncertainty_include'],
      uidesign: 'form',
      label: 'meta',
    },
    validationSchema: {
      fields: ['validationSchema'],
      uidesign: 'form',
      label: 'validationSchema',
    },
    access: {
      fields: ['access'],
      uidesign: 'form',
      label: 'access',
    },
    FormParamater: {
      fields: ['required'],
      uidesign: 'form',
      label: 'FormParamater',
    },
  },
  viewsets: {
    notes: {
      views: ['meta'],
      label: 'notes',
    },
    access: {
      views: ['access'],
      label: 'access',
    },
    valid: {
      views: ['FormParamater', 'validationSchema'],
      label: 'valid',
    },
  },
  visible_types: ['notes', 'valid', 'access'],
};

const regeneratesettinguiSpec = (
  uiSpec: ProjectUIModel,
  fieldName: string,
  designvalue: string
) => {
  const newui: ProjectUIModel = {
    fields: {},
    views: {},
    viewsets: {},
    visible_types: [],
  };
  const fields: ProjectUIFields = {};
  const fieldsnames: Array<string> = [];
  uiSpec['visible_types'].map((viewset: string) =>
    fieldsnames.push(...uiSpec['viewsets'][viewset]['views'])
  );
  fieldsnames.map((view: string) => (fields[view] = []));
  for (const [key, value] of Object.entries(uiSpec['fields'])) {
    const newname = key + fieldName;
    newui['fields'][newname] = generatenewname(value, newname);
    //
    fieldsnames.map((view: string) => {
      if (uiSpec['views'][view]['fields'].includes(key)) {
        fields[view].push(newname);
      }
    });
  }
  uiSpec['visible_types'].map((viewset: string) =>
    uiSpec['viewsets'][viewset]['views'].map(
      (view: string) =>
        (newui['views'][view] = {
          fields: fields[view],
          uidesign: 'form',
          label: view,
        })
    )
  );
  newui['visible_types'] = uiSpec['visible_types'];
  newui['viewsets'] = uiSpec['viewsets'];
  return newui;
};

export const generatenewname = (fieldui: ProjectUIFields, newname: string) => {
  const newfield = JSON.parse(JSON.stringify(fieldui));
  newfield['component-parameters']['id'] = newname;
  newfield['component-parameters']['name'] = newname;
  return newfield;
};

export const generatenewfield = (
  namespace: string,
  componentName: string,
  fieldui: ProjectUIFields | null,
  fieldName: string | null,
  props: any | null
) => {
  let uifield: ProjectUIFields =
    fieldui === null
      ? getComponentPropertiesByName(namespace, componentName).settingsProps[1]
      : fieldui;
  if (fieldName !== null) uifield = generatenewname(uifield, fieldName);
  if (uifield['component-name'] === 'BasicAutoIncrementer') {
    uifield['component-parameters']['form_id'] = props.currentform;
    return uifield;
  }
  // if(props!==null){
  //   for (const [key, value] of props) {
  //     uifield[key]=value
  //   }
  // }

  return uifield;
};

export const getdvalue = (value: any) => {
  return JSON.parse(JSON.stringify(value));
};

const getvalue = (
  fieldui: ProjectUIFields,
  field: string,
  view: string,
  fieldName: string
) => {
  const name = field.replace(fieldName, '');
  if (view === 'FormParamater') return fieldui['component-parameters'][name];
  if (name === 'options' && view === 'ElementProps') {
    const options = fieldui['component-parameters']['ElementProps']['options'];
    let returnvalue = '';
    options.map(
      (option: any) => (returnvalue = option.value + ',' + returnvalue)
    );
    return returnvalue;
  }
  if (['access', 'validationSchema'].includes(view)) return fieldui[name];
  if (view === 'meta' && fieldui['meta'] !== undefined) {
    if (name === 'uncertainty_include' || name === 'uncertainty_label')
      return fieldui['meta']['uncertainty'][name.replace('uncertainty_', '')];
    return fieldui['meta'][name];
  }
  try {
    return (
      fieldui['component-parameters'][view][name] ??
      fieldui['component-parameters'][view]['children']
    );
  } catch {
    console.error('error to get value:' + view + name);
    return 'not get value' + view + name;
  }
};

export const setSetingInitialValues = (
  uiSetting: ProjectUIModel,
  fieldui: ProjectUIFields,
  fieldName: string
) => {
  const initialValues: ProjectUIFields = {};

  // initialValues[fieldName]=fieldui['initialValue']
  // if(fieldui['component-name']==='TakePoint') initialValues[fieldName]=null

  uiSetting['viewsets']['settings']['views'].map((view: string) =>
    uiSetting['views'][view]['fields'].map(
      (field: string) =>
        (initialValues[field + fieldName] = getvalue(
          fieldui,
          field,
          view,
          fieldName
        ))
    )
  );
  const othersuiSpec = uiSettingOthers;
  othersuiSpec.visible_types.map((viewsets: string) =>
    othersuiSpec['viewsets'][viewsets]['views'].map((view: string) =>
      othersuiSpec['views'][view]['fields'].map(
        (field: string) =>
          (initialValues[field + fieldName] = getvalue(
            fieldui,
            field,
            view,
            fieldName
          ))
      )
    )
  );
  return initialValues;
};

const isArrayInArray = (arr: Array<any>, item: Array<any>) => {
  const item_as_string = JSON.stringify(item);
  const contains = arr.some(ele => {
    return JSON.stringify(ele) === item_as_string;
  });
  return contains;
};

const Componentsetting = (props: componenentSettingprops) => {
  const {handlerchangewithview, ...others} = props;

  const [uiSetting, setuiSetting] = useState(props.uiSetting);

  useEffect(() => {
    //this function should be used to get new project ui when project_id changes??
    setini();
  }, [
    props.projectvalue['forms'][props.currentform][
      'uncertainty' + props.currentform
    ],
  ]);

  const updatecertainty = (value: boolean) => {
    if (value === true) {
      const newuis: ProjectUIModel = uiSetting;
      newuis['views']['meta']['fields'] = [
        'annotation_label' + props.fieldName,
        'uncertainty_include' + props.fieldName,
        'uncertainty_label' + props.fieldName,
      ];
      newuis['fields']['uncertainty_include' + props.fieldName].checked = true;
      console.log('value true');
      console.log(newuis['views']['meta']);
      setuiSetting({...newuis});
    }

    if (value === false) {
      const newuis: ProjectUIModel = uiSetting;
      newuis['views']['meta']['fields'] = [
        'annotation_label' + props.fieldName,
        'uncertainty_include' + props.fieldName,
      ];
      newuis['fields']['uncertainty_include' + props.fieldName].checked = false;
      setuiSetting({...newuis});
    }
  };
  const setini = () => {
    updatecertainty(
      props.projectvalue['forms'][props.currentform][
        'uncertainty' + props.currentform
      ] ?? true
    );
  };
  const handlerchanges = (event: any) => {
    const name = event.target.name.replace(props.fieldName, '');
  };

  const handlerchangewithviewSpec = (event: any, view: string) => {
    //any actions that could in this form
    props.handlerchangewithview(event, view);
    console.log(view + event.target.name + props.fieldName);
    if (
      view === 'meta' &&
      props.uiSpec['fields'][props.fieldName]['meta'] !== undefined
    ) {
      const newvalues = props.uiSpec;
      const name = event.target.name.replace(props.fieldName, '');
      if (name === 'uncertainty_include')
        newvalues['fields'][props.fieldName]['meta']['uncertainty'][
          name.replace('uncertainty_', '')
        ] = event.target.checked;
      if (name === 'uncertainty_label')
        newvalues['fields'][props.fieldName]['meta']['uncertainty'][
          name.replace('uncertainty_', '')
        ] = event.target.value;
      else if (name === 'annotation_label')
        newvalues['fields'][props.fieldName]['meta'][name] = event.target.value;
      props.setuiSpec({...newvalues});

      if (name === 'uncertainty_include') {
        const value = event.target.checked;
        updatecertainty(value);
        console.log(uiSetting);
      }
    }
    if (view === 'FormParamater') {
      const newvalues = props.uiSpec;
      const name = event.target.name.replace(props.fieldName, '');
      if (name === 'required') {
        const value = event.target.checked;
        if (value === true) {
          if (
            !isArrayInArray(
              newvalues['fields'][props.fieldName]['validationSchema'],
              ['yup.required']
            )
          ) {
            newvalues['fields'][props.fieldName]['validationSchema'].push([
              'yup.required',
            ]);
            props.setuiSpec({...newvalues});
            console.log('Not contain' + 'SHOULD');
          }

          if (
            isArrayInArray(
              newvalues['fields'][props.fieldName]['validationSchema'],
              ['yup.required']
            )
          ) {
            newvalues['fields'][props.fieldName][
              'validationSchema'
            ] = newvalues['fields'][props.fieldName]['validationSchema'].filter(
              (valid: Array<string>) => {
                return !valid.includes('yup.required');
              }
            );
            props.setuiSpec({...newvalues});
            console.log('Contain' + 'SHould NOT');
          }
        }
        console.log(newvalues['fields'][props.fieldName]['validationSchema']);
      }
    }
    console.log(event.target.name + view + event.target.checked);
  };
  return (
    <Defaultcomponentsetting
      handlerchangewithview={handlerchangewithviewSpec}
      handlerchanges={handlerchanges}
      {...others}
      fieldui={props.fieldui}
      uiSetting={uiSetting}
    />
  );
};

const getuivalue = (
  namespace: string,
  componentName: string,
  uiSpec: ProjectUIModel,
  fieldName: string,
  designvalue: string
) => {
  if (designvalue === 'settings') {
    const originprops = getComponentPropertiesByName(namespace, componentName);
    const fieldui = uiSpec['fields'][fieldName] ?? originprops.settingsProps[1];
    const uiSetting = originprops.settingsProps[0];
    const newui = regeneratesettinguiSpec(uiSetting, fieldName, designvalue);
    const Component = originprops.builder_component;
    return {newui, fieldui, Component};
  } else {
    const uiSetting = uiSettingOthers;
    const fieldui = uiSpec['fields'][fieldName];
    const newui = regeneratesettinguiSpec(uiSetting, fieldName, designvalue);
    const Component = Componentsetting;
    return {newui, fieldui, Component};
  }
};

export function ResetComponentProperties(props: resetprops) {
  const {
    namespace,
    componentName,
    uiSpec,
    setuiSpec,
    fieldName,
    formProps,
    designvalue,
    currentview,
    currentform,
    initialValues,
    setinitialValues,
    projectvalue,
  } = props;
  const {newui, fieldui, Component} = getuivalue(
    namespace,
    componentName,
    uiSpec,
    fieldName,
    designvalue
  );

  const handlerchangefunction = (
    event: FAIMSEVENTTYPE,
    elementprop: string
  ) => {
    if (['meta', 'access', 'validationSchema'].includes(elementprop))
      return true;
    const newvalues = uiSpec;
    let ishird = false;
    const newfieldname = HRID_STRING + currentform;
    if (
      newvalues['fields'][fieldName]['component-name'] ===
        'TemplatedStringField' &&
      newvalues['fields'][fieldName]['component-parameters']['hrid'] === true
    ) {
      //set newvalue for hird

      ishird = true;
      console.log('++++++++++++++' + newfieldname);
    }
    if (newvalues['fields'][fieldName] === undefined) {
      newvalues['fields'][fieldName] = generatenewname(fieldui, fieldName);
    }
    const name = event.target.name.replace(fieldName, '');
    if (elementprop === 'FormParamater')
      if (name === 'required') {
        newvalues['fields'][fieldName]['component-parameters'][name] =
          event.target.checked;
        if (ishird)
          newvalues['fields'][newfieldname]['component-parameters'][name] =
            event.target.checked;
      } else if (name === 'hrid') {
        //not update value here
        // newvalues['fields'][fieldName]['component-parameters'][name] =
        // event.target.checked;
      } else {
        newvalues['fields'][fieldName]['component-parameters'][name] =
          event.target.value;
        if (ishird)
          newvalues['fields'][newfieldname]['component-parameters'][name] =
            event.target.value;
      }
    else if (
      elementprop === 'FormLabelProps' ||
      elementprop === 'FormHelperTextProps'
    ) {
      newvalues['fields'][fieldName]['component-parameters'][elementprop][
        'children'
      ] = event.target.value;
      if (ishird)
        newvalues['fields'][newfieldname]['component-parameters'][elementprop][
          'children'
        ] = event.target.value;
    } else if (name !== 'options') {
      newvalues['fields'][fieldName]['component-parameters'][elementprop][
        name
      ] = event.target.value;
      if (ishird)
        newvalues['fields'][newfieldname]['component-parameters'][elementprop][
          name
        ] = event.target.value;
    }

    setuiSpec({...newvalues});
    return true;
  };

  const handlerchangewithview = (event: FAIMSEVENTTYPE, view: string) =>
    handlerchangefunction(event, view);

  return (
    <>
      {uiSpec['fields'][fieldName] !== undefined && (
        <Component
          uiSetting={newui}
          formProps={formProps}
          component={Component}
          uiSpec={uiSpec}
          setuiSpec={setuiSpec}
          fieldName={fieldName}
          fieldui={fieldui}
          designvalue={designvalue}
          handlerchangewithview={handlerchangewithview}
          currentview={currentview}
          currentform={currentform}
          initialValues={initialValues}
          setinitialValues={setinitialValues}
          projectvalue={projectvalue}
        />
      )}
    </>
  );
}
