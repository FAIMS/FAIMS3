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
 * Filename: ComponentSetting.ts
 * Description:
 *   TODO: ADD function to pass and update validationschema
 *   TODO: ADD function to pass and update access
 *   TODO: FieldSettings is hardcode, need to get value from bundle_components
 *   TODO: any type
 *   TODO: newfromui is the function to get form components for edit notebook, NOT WORKING
 *   TODO: function to create notebook create/update uiSpec
 *   TODO: NEW field chips added, input and select field for access
 */

import {v4 as uuidv4} from 'uuid';
import {getcomponent} from './uiFieldsRegistry';
import {getComponentPropertiesByName} from '../../../component_registry';
import {setSetingInitialValues,generatenewname,generatenewfield} from './componenentSetting'
import {
  ProjevtValueList,
  FAIMShandlerType,
  ProjectUIModel,
  FAIMSUiSpec} from '../../../../datamodel/ui'
import {ProjectUIFields} from '../../../../datamodel/typesystem'

const VISIBLE_TYPE = 'visible_types';
const NEWFIELDS = 'newfield';
const DEFAULT_accessgroup = ['admin', 'moderator'];
const DEFAULT_accessgroup_d = ['admin', 'moderator', 'team'];
const CONNECTION_RELATIONS = ['To be added'];


export type uiSpecType = {
  fields: any;
  views: any;
  viewsets: any;
  visible_types: any;
};

type signlefieldType = any;
type fieldlistType = any;
type viewlistType = any;
type optionType = {value: string; label: string};
type tabLinkType = {tab: string; link: string};
type projectuilistType = any;
export const getid = () => {
  return uuidv4().split('-')[0];
};

export const getconnections = (
  comparetab: string,
  uiSpec: uiSpecType,
  tabs: Array<string>
) => {
  const connecions = CONNECTION_RELATIONS;
  const conectiontabs: Array<tabLinkType> = [];
  uiSpec['viewsets'][comparetab]['views'].map((view:string)=>
    uiSpec['views'][view]['fields'].map((field:string)=>
      uiSpec['fields'][field]['component-name']==='RelatedRecordSelector'?uiSpec['fields'][field]['component-parameters']['related_type']!==''&&
      conectiontabs.push({tab:uiSpec['viewsets'][uiSpec['fields'][field]['component-parameters']['related_type']]['label'],link:uiSpec['fields'][field]['component-parameters']['relation_type'].replace('faims-core::','')}):
      field
    )
  )
  //TODO get relation of tabs and return
  // tabs.map((tab: string) =>
  //   conectiontabs.push({tab: tab, link: connecions[0]})
  // );
  return conectiontabs;
};

export const checkvalid = (values:Array<string>) =>{
  values=values.filter((value:string)=>value!=='')
  values=values.filter((item,pos)=> {
    return values.indexOf(item) === pos;
  })
  return values;

}

// export const getfieldname = (name: string, label: string) => {
//   const names = name.split(label);
//   if (names.length > 1)
//     return {type: names[0], name: label + names[1], index: names[1]};
//   return {type: '', name: '', index: 0};
// };

export const getacessoption = (access: Array<string>) => {
  const options: Array<optionType> = [];
  const limitaccess = access.filter((access: string) => !(access === 'admin'));
  access.map(
    (option: string, index: number) =>
      (options[index] = {
        value: option,
        label: option,
      })
  );
  return options;
};
//Add new field form or convert uiSpec to setting form convertuiSpectoSetting
export const FieldSettings = (
  component: signlefieldType,
  label: string,
  props: any,
  access: Array<string> = DEFAULT_accessgroup_d
) => {
  const options: Array<optionType> = getacessoption(access);
  const fields = [
    {name: '', lable: '', type: 'TextField', view: 'general'},
    {
      name: 'label',
      lable: 'Text Field Label',
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      view: 'settings',
    }
  ];


	const fields_label:Array<string>=[]
  const fields_list: fieldlistType = {};
  const view_list = ['settings', 'valid', 'access', 'notes', 'general'];
  const views: viewlistType = {
    'start-view': {fields: [], uidesign: 'settings'},
  };
  view_list.map(view => (views[view] = {fields: [], uidesign: 'settings'}));
  fields.map((field, index) => {
    const fieldname = field.name + `${label}`;
    fields_label[index] = fieldname;
    if (index === 0) {
      fields_list[fieldname] = component;
    } else {
      //field.type,
      const {lable, name, namespace, componentName, view, ...others} = field;
      fields_list[fieldname] = getcomponent({
        name: fieldname,
        label: lable,
        initialValue: props[name],
        namespace: namespace,
        componentName: componentName,
        placeholder: props[name] !== undefined ? props[name].toString() : name,
        ...others,
      });
    }
    const view = field.view;
    if (
      !(
        component['component-name'] === 'TemplatedStringField' &&
        field.name === 'required'
      )
    )
      views[view]['fields'] = [...views[view]['fields'], fieldname];
    views[view]['uidesign'] = 'settings';
  });
  views['start-view'] = {fields: fields_label, uidesign: 'settings'};

  return {
    fields: fields_list,
    views: views,
    view_list: view_list,
    start_view: 'start-view',
  };
};

export const gettabform = (tabs: Array<string>) => {
  const fields_list: any = {};
  const fields: Array<string> = [];
  //'TextField',
  tabs.map((tab: string, index: number) => {
    fields_list['formelement' + index] = getcomponent({
      name: 'formelement' + index,
      lable: tab,
      initialValue: tab,
      placeholder: tab,
    });
    fields[index] = 'formelement' + index;
  });

  return {
    fields: fields_list,
    views: {'start-view': {fields: fields, uidesign: 'tab'}},
    start_view: 'start-view',
  };
};

export const getprojectform = (
  projectvalue: ProjevtValueList,
  tab: string,
  props: any = null
) => {
  //this function is just template to get information about the project
  const fields_list: any = {};
  const fieldsarray: Array<string> = [];
  const section_info = [
    {
      name: 'sectionname',
      label: 'Section Name',
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      view: 'section',
      required: true,
    },
    {
      name: 'sectiondescription',
      label: 'Description',
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      view: 'section',
      multiline: true,
      multirows: 4,
    },
    // {name:'sectiondeaccess',label:'Access',namespace:'formik-material-ui',componentName:'TextField',view:'section',multiline:true,multirows:4,helperText:'Now disbaled, Will be enabled after access field been defined.'},
    {
      name: 'sectiondeaccessinherit',
      label: 'Inherit Access From Form',
      namespace: 'faims-custom',
      componentName: 'Checkbox',
      type_return: 'faims-core::Bool',
      validationSchema: [['yup.bool']],
      type: 'checkbox',
      initialValue: false,
      helperText: 'Check to inherit from Form',
    },
  ];
  const form_info_options: Array<optionType> = [
    {
      value: 'Save and New',
      label: 'Save and New',
    },
    {
      value: 'Jump to Upper Level',
      label: 'Jump to Upper Level',
    },
  ];
  const options = getacessoption(projectvalue.accesses);
  const form_info = [
    // {name:'Formdescription',label:'Description',namespace:'formik-material-ui',componentName:'TextField',view:'form',multiline:true,multirows:4},
    {
      name: 'submitAction',
      label: 'Form Submit Action',
      namespace: 'faims-custom',
      componentName: 'Select',
      select: true,
      type: 'select',
      options: form_info_options,
      view: 'form',
      required: true,
      helperText: 'Select action to take when user submits the record',
    },
    //{name:'access',lable:'access',namespace:'faims-custom',componentName:'Select',select: true,type:'select',view:'access',options:options,helperText:'It will be replace to the new field'},//TODO: working on newfield
    // {name:'accessinherit',label:'Inherit Access From Notebook',namespace:'faims-custom',componentName:'Checkbox',type_return:'faims-core::Bool',validationSchema:[['yup.bool'],],type: 'checkbox',initialValue:false,helperText:'Check to inherit from NoteBook'},
    // {name:'accesses',label:'Accesses',namespace:'faims-custom',componentName:'AutoComplete',type_return:'faims-core::String',validationSchema:[['yup.string'],],type:'text',select:true,options:getacessoption(projectvalue.accesses)}
  ];

  const form_setting= [
    {
      name: 'annotation',
      label: 'Annotation',
      namespace: 'faims-custom',
      componentName: 'Checkbox',
      type_return: 'faims-core::Bool',
      validationSchema: [['yup.bool']],
      type: 'checkbox',
      initialValue: false,
      helperText: 'Tick for enable Annotation for Form components',
    },
    {
      name: 'uncertainty',
      label: 'Uncertainty',
      namespace: 'faims-custom',
      componentName: 'Checkbox',
      type_return: 'faims-core::Bool',
      validationSchema: [['yup.bool']],
      type: 'checkbox',
      initialValue: false,
      helperText: 'Tick for enable Uncertainty for Form components',
    }
  ]

  const users = [
    {
      name: 'users',
      label: 'Users',
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      view: 'users',
      multiline: true,
      multirows: 4,
      disable: projectvalue.ispublish ?? false,
      initialValue: projectvalue.users,
      helperText: 'It will be actived after Notebook is online',
    },
    {
      name: 'usersassinged',
      label: 'Users',
      namespace: 'formik-material-ui',
      componentName: 'TextField',
      view: 'users',
      multiline: true,
      multirows: 4,
      disable: projectvalue.ispublish ?? false,
      helperText: 'It will be actived after Notebook is online',
    },
  ];

  const preview = {
    name: 'preview',
    label: 'Select User Role to Preview',
    namespace: 'faims-custom',
    componentName: 'Select',
    select: true,
    view: 'preview',
    helperText: 'Select to get form for roles'}

  const fields: projectuilistType = {
    info_general: [
      {
        name: 'name',
        label: 'Project Name',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'info_general',
        required: true,
        initialValue:projectvalue.name,
        helperText:'Enter a string between 2 and 100 characters long',
        validationSchema: [
          ['yup.string'],
          ['yup.min', 1, 'Too Short!'],
          ['yup.max', 100, 'Too Long!'],
          ['yup.required'],
        ],
      },
      {
        name: 'description',
        label: 'Description',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'info_general',
        multiline: true,
        multirows: 4,
        initialValue:projectvalue.description,
      },
      {
        name: 'project_lead',
        label: 'Lead',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'info_general',
        initialValue:projectvalue.project_lead,
      },
      {
        name: 'lead_institution',
        label: 'lead_institution',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'info_general',
        initialValue:projectvalue.lead_institution,
      },
    ],
    info_group: [
      {
        name: 'accessadded',
        label: 'Add User Roles',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'info_group',
        required: false,
        value: projectvalue['accessadded'],
      },
    ],
    attachments: [
      {
        name: 'attachments',
        label: 'Upload Attachements',
        namespace: 'faims-custom',
        componentName: 'FileUploader',
        view: 'attachments',
        required: false,
      },
    ],
    section: [],
    form: [],
    users: [
      {
        name: 'users',
        label: 'Add User',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'users',
        required: false,
        multiline: true,
        multirows: 4,
      },
    ],
    usersassign: [
      //users info will be defined by access groups
    ],
    behaviours: [
      {
        name: 'Sync',
        label: 'Automatic Updates',
        namespace: 'faims-custom',
        componentName: 'Checkbox',
        view: 'behaviours',
        required: true,
        disabled: true,
        value: true,
        initialValue: true,
        helperText:
          'Automatically save changes the user makes as they occur. Automatically retrive changes made by other users every 30s (if online)',
      },
    ],
    preview: [],
    form_setting:[],
    project_meta:[],
    projectmetaadd:[
      {
        name: 'metaadd',
        label: 'Add new meta data Label',
        namespace: 'formik-material-ui',
        componentName: 'TextField',
        view: 'projectmetaadd',
        helperText: '',
        initialValue:''
      }
    ]
  };

  // This part will be updated in the future TODO
  if (projectvalue.project_id !== undefined&&projectvalue.project_id!==null) {
    fields['info_general'][0].disabled = true;
    // fields['info_general'][0].value=projectvalue.name
    fields['info_general'][1].disabled = true;
  }
  if (tab === 'section') {
    //create new section form for each section
    section_info.map((field: any, index: number) => {
      if (field.name === 'sectiondeaccess') {
        //setup initialvalue for the access
        const formvirant = props.sectionname.split('SECTION')[0];
        const iniaccess = projectvalue['access' + formvirant];
        field['initialValue'] = iniaccess ?? projectvalue.accesses;
      }
      const fieldname = field.name + props.sectionname;
      const newfield = {...field, name: fieldname};
      if (
        projectvalue['sections'] !== undefined &&
        newfield['initialValue'] === undefined
      )
        if (projectvalue['sections'][props.sectionname] !== undefined)
          newfield['initialValue'] =
            projectvalue['sections'][props.sectionname][fieldname];
        else if (newfield['initialValue'] === undefined)
          newfield['initialValue'] = undefined;
      fields[tab][index] = {...newfield};
    });
  }
  if (tab === 'form') {
    //create new section form for each section
    form_info.map((field: any, index: number) => {
      const fieldname = field.name + props.formname;
      const newfield = {...field, name: fieldname};
      //TODO Maybe set pre-select value for user
      // if(projectvalue['forms']!==undefined&&newfield['initialValue']===undefined)
      //   if(projectvalue['forms'][props.props.formname]!==undefined) newfield['initialValue']=['forms'][props.props.formname][fieldname]
      // else if(newfield['initialValue']===undefined)
      //   newfield['initialValue']='Save and New'
      fields[tab][index] = {...newfield};
    });
  }
  if(tab ==='form_setting'){
    form_setting.map((field: any, index: number) => {
      const fieldname = field.name + props.formname;
      const newfield = {...field, name: fieldname};
      //TODO Maybe set pre-select value for user
      // if(projectvalue['forms']!==undefined&&newfield['initialValue']===undefined)
      //   if(projectvalue['forms'][props.props.formname]!==undefined) newfield['initialValue']=['forms'][props.props.formname][fieldname]
      // else if(newfield['initialValue']===undefined)
      //   newfield['initialValue']='Save and New'
      fields[tab][index] = {...newfield};
    });
  }
  if( tab==='project_meta' &&projectvalue.meta!==undefined&&projectvalue.meta!==null){
    fields[tab]=[]
    if(projectvalue.meta!==undefined&&projectvalue.meta!==null){
      for (const [key, value] of Object.entries(projectvalue.meta)) {
        fields[tab].push(
        {
          name: key,
          label: key,
          namespace: 'formik-material-ui',
          componentName: 'TextField',
          view: tab,
          initialValue:value
        })
      }
    }
    
  }

  if (tab === 'project') {
    fields['project'] = [...fields['info_general'],...fields['project_meta'], ...fields['behaviours']];
  }


  if (tab === 'preview') {
    props.forms.map((formtab: string, index: number) => {
      const newfield = {...preview, name: preview.name + formtab};
      const options = getacessoption(
        projectvalue['access' + formtab] ?? projectvalue.accesses
      );
      fields[tab][index] = {...newfield, options: options};
    });
  }

  if (tab === 'usersassign') {
    fields[tab] = [];
    projectvalue.accesses.map((access: string) =>
      users.map(
        (user: any) =>
          (fields[tab] = [...fields[tab], {...user, name: user.name + access}])
      )
    );
  }

  if (fields[tab].length > 0) {
    fields[tab].map((field: any, index: number) => {
      const {name, view, initialValue, ...others} = field;
      fields_list[field.name] = getcomponent({
        name: name,
        initialValue: initialValue ?? projectvalue[name],
        placeholder: projectvalue[name],
        ...others,
      });
      fieldsarray[index] = field.name;
    });
  }
  const returnui:any={
    fields: fields_list,
    views: {'start-view': {fields: fieldsarray, uidesign: tab}},
    start_view: 'start-view',
    viewsets: {},
    visible_types: [tab],
  }
  returnui['viewsets'][tab]={
    "views": [
      "start-view"
    ],
    "label": tab
  }
  return returnui;
};

export const setProjectInitialValues = (
  uiSpec: uiSpecType,
  currentView: string,
  initialValues: any
) => {
  const existingData: {
    [viewName: string]: {[fieldName: string]: unknown};
  } = {};
  const fields = uiSpec['fields'];
  const fieldNames = uiSpec['views'][currentView]['fields'];
  fieldNames.forEach((fieldName: string) => {
    initialValues[fieldName] =
      existingData?.[fieldName] || fields[fieldName]['initialValue'];
  });
  return initialValues;
};

export function generateaddfieldui() {
  return true;
}

export const updateuiSpec = (type: string, props: any) => {
  const newuiSpec = props.formuiSpec;
  const newformcom = props.formcomponents;
  switch (type) {
    case 'formvariantsupdate':
      return updatelabel(true, props);
    case 'formvsectionupdate':
      return updatelabel(false, props);
    case 'formvariantsadd':
      return formvariantsadd(props);
    case 'formvsectionadd':
      return formvsectionadd(props);
    case 'newfromui':
      return newfromui(props.formuiSpec, props.formcomponents, props.access,props.initialfieldvalue);
    case 'switch':
      return swithField(
        props.index,
        props.type,
        props.formuiSpec,
        props.formcomponents,
        props.formuiview
      );
    case 'removefield':
      return removefield(
        props.index,
        props.formuiSpec,
        props.formcomponents,
        props.formuiview
      );
    case 'addfield':
      return addfield(props);
    // case 'updatefield':
    //   return updatefield(props);
    default:
      return newuiSpec;
  }
};

const updatelabel = (type: boolean, props: any) => {
  const newviews = props.formuiSpec;
  const components = props.formcomponents;
  props.tabs.map((tab: string, index: number) => {
    if (type) {
      //update form label
      const tabid = newviews[VISIBLE_TYPE][index];
      newviews['viewsets'][tabid]['label'] = tab;
    } else {
      const tabid = newviews['viewsets'][props.formvariants]['views'][index];
      newviews['views'][tabid]['label'] = tab;
    }

  })
  return {newviews, components};
};

const newfromui = (
  newuiSpec: uiSpecType,
  newformcom: any,
  access: Array<string>,
  initialfieldvalue:any
) => {
  newuiSpec[VISIBLE_TYPE].map((variant: any, index: any) => {
    newuiSpec['viewsets'][variant]['views'].map((view: string) => {
      newformcom[view] = [];
      newuiSpec['views'][view]['fields'].map((fieldname: string) => {
        const field = newuiSpec['fields'][fieldname];
        if(field['meta']===undefined) 
        field['meta']={
          "annotation_label": "annotation",
          "uncertainty": {
            "include": false,
            "label": "uncertainty"
          }
        }
        const fieldprops = {};
        const newuiSpeclist = FieldSettings(
          field,
          fieldname,
          fieldprops,
          access
        );
        initialfieldvalue={...initialfieldvalue,
          ...setSetingInitialValues(getComponentPropertiesByName(field['component-namespace'],field['component-name']).settingsProps[0],field,fieldname)}
        newformcom[view] = [
          ...newformcom[view],
          {
            id: fieldname.replace(NEWFIELDS, ''),
            uiSpec: newuiSpeclist,
            designvalue: 'settings',
            componentName:field['component-name'],
            namespace:field['component-namespace']
          },
        ];
      });
    });
  });
  return {newformcom,initialfieldvalue};
};

const swithField = (
  index: any,
  type: boolean,
  formuiSpec: uiSpecType,
  formcomponents: any,
  formuiview: string
) => {
  const newviews = formuiSpec;
  const components = formcomponents;
  const fields = formuiSpec['views'][formuiview]['fields'];
  const field = fields[index];
  const component = formcomponents[formuiview][index];
  fields.splice(index, 1);
  components[formuiview].splice(index, 1);
  if (type) index = index + 1;
  //down
  else index = index - 1; //up
  fields.splice(index, 0, field);
  components[formuiview].splice(index, 0, component);
  newviews['views'][formuiview]['fields'] = fields;
  return {newviews, components};

    }
const removefield = (
  id: string,
  formuiSpec: uiSpecType,
  formcomponents: any,
  formuiview: string
) => {
  const name = NEWFIELDS + id;
  const components = formcomponents;
  components[formuiview] = components[formuiview].filter(
    (formcomponent: any) => formcomponent.id !== id
  );
  const newviews = formuiSpec;
  newviews['views'][formuiview]['fields'] = newviews['views'][formuiview][
    'fields'
  ].filter((field: any) => field !== name);
  return {newviews, components};
};


const addfield = (props: any) => {
  const {uuid, id, formuiSpec, formcomponents, formuiview, accessgroup,project_id} = props;
  const settings=id
  const name = NEWFIELDS + uuid;
  const newfield: ProjectUIFields= settings.settingsProps!==undefined&&settings.settingsProps.length>1? {...generatenewfield('','',settings.settingsProps[1],name,{project_id:project_id,currentform:formuiview}),access:accessgroup}:getcomponent({
    name: name,
    label: id.uiSpecProps.componentName,
    access: accessgroup,
    ...id.uiSpecProps,
  });
  if(newfield['meta']===undefined) 
  newfield['meta']={
            "annotation_label": "annotation",
            "uncertainty": {
              "include": false,
              "label": "uncertainty"
            }
          }
  const newuiSpec = formuiSpec.fields;
  newuiSpec[name] = newfield;
  const newviews = formuiSpec.views;
  const fieldprops = {};
  const newuiSpeclist = FieldSettings(newfield, name, fieldprops, accessgroup);
  const components = formcomponents;
  newviews[formuiview]['fields'] = [...newviews[formuiview]['fields'], name];
  components[formuiview] = [
    ...components[formuiview],
    {id: uuid, uiSpec: newuiSpeclist, designvalue: 'settings',componentName:newfield['component-name'],namespace:newfield['component-namespace']},
  ];
  const initialfieldvalue=setSetingInitialValues(settings.settingsProps[0],newfield,name)
  return {newviews, components, newuiSpeclist, newuiSpec,initialfieldvalue};
};

// const updatefield = (props: any) => {
//   //TODO: check this part
//   const {event, formuiSpec, formcomponents, formuiview, access} = props;
//   const fieldname = event.target.name;
//   const fieldvalue = event.target.value;
//   const updatedfield = getfieldname(fieldname, NEWFIELDS);
//   const components = formcomponents;
//   const newviews = formuiSpec;
//   if (
//     formuiSpec !== undefined &&
//     updatedfield.name !== '' &&
//     updatedfield.type !== ''
//   ) {
//     const newfieldname = updatedfield.name;
//     const fieldtype = updatedfield.type;
//     if (fieldtype === 'validationSchema') return {newviews, components};
//     if (fieldtype === 'accessinherit') {
//       //TODO
//       return {newviews, components};
//     }
//     const fieldprops = convertuiSpecToProps(formuiSpec['fields'][newfieldname]);
//     if (fieldtype === 'required' || fieldtype === 'meta_type')
//       fieldprops[fieldtype] = !fieldprops[fieldtype];
//     else fieldprops[fieldtype] = fieldvalue;
//     if (fieldtype === 'options') {
//       fieldprops[fieldtype] = [];
//       const options = fieldvalue.split(' ');
//       options.map(
//         (option: string, index: number) =>
//           (fieldprops[fieldtype][index] = {
//             value: option,
//             label: option,
//           })
//       );
//     }
//     if (fieldtype === 'access') {
//       try {
//         let access = fieldvalue.split(',');
//         //remove the empty one
//         access = access.filter((value: string) => value !== '');
//         fieldprops[fieldtype] = access;
//         if (!fieldprops[fieldtype].includes('admin')) {
//           fieldprops[fieldtype] = [...fieldprops[fieldtype], 'admin'];
//         }
//         console.log(access);

//       }catch(error){
//         console.error('Failed to pass access group');
//         console.error(error);
//       }

//       // if(typeof fieldprops[fieldtype]==='string') fieldprops[fieldtype]=[fieldprops[fieldtype]]
//       // DEFAULT_accessgroup.map((accessrole:string)=>fieldprops[fieldtype].includes(accessrole)?accessrole:fieldprops[fieldtype]=[...fieldprops[fieldtype],accessrole])
//     }

//     if (fieldtype === 'validationSchema') {
//       fieldprops[fieldtype] = [];
//       const validationSchemas = fieldvalue.split(',');
//       validationSchemas.map(
//         (validationSchema: string, index: number) =>
//           (fieldprops[fieldtype][index] = [validationSchema])
//       ); // this function need to be updated
//     }
//     const newfield = getcomponent(fieldprops); //fieldprops['type']??fieldprops['component-name'],
//     const fields = changeuifield(newfieldname, newfield, formuiSpec['fields']);

//     components[formuiview].map((item: any) => {
//       item.id === updatedfield.index
//         ? (item['uiSpec']['fields'] = changeuifield(
//             newfieldname,
//             newfield,
//             item['uiSpec']['fields']
//           ))
//         : item;
//     });
//   }
//   return {newviews, components};
// };

const changeuifield = (newfieldname: string, newfield: any, uiSpec: any) => {
  //update the formuiSpec
  const fields = uiSpec;
  fields[newfieldname] = newfield;
  return fields;
};

const formvsectionadd = (props: any) => {
  const {tabs, formuiSpec, formcomponents, formvariants} = props;
  const index = tabs.length - 1;
  const newtabname = tabs[index];
  const newviews = formuiSpec;
  const components = formcomponents;
  const name = formvariants + newtabname;

  if (newviews['views'][name] === undefined) {
    newviews['views'][name] = {fields: [], uidesign: 'form', label: newtabname};
    newviews['viewsets'][formvariants]['views'] = [
      ...newviews['viewsets'][formvariants]['views'],
      name,
    ];
  }

  if (components[name] === undefined) {
    components[name] = [];
  }
  return {newviews, components};
};

const formvariantsadd = (props: any) => {
  const {tabs, formuiSpec, formcomponents, formuiview} = props;
  const index = tabs.length - 1;
  const newtabname = tabs[index];
  const newviews = formuiSpec;
  const components = formcomponents;
  newviews[VISIBLE_TYPE] = [...newviews[VISIBLE_TYPE], newtabname]; //add new tab
  if (newviews['viewsets'][newtabname] === undefined) {
    newviews['viewsets'][newtabname] = {views: [], label: newtabname};
  }
  return {newviews, components};
};
