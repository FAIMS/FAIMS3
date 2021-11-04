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
 * Filename: TemplatedStringField.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import Mustache from 'mustache';
import { Defaultcomponentsetting,getDefaultuiSetting } from './BasicFieldSettings';
import {generatenewfield} from '../components/project/data/componenentSetting'
import LibraryBooksIcon from '@material-ui/icons/Bookmarks';
import {option} from '../../datamodel/typesystem'
import {ProjectUIModel,componenentSettingprops,FAIMSEVENTTYPE} from '../../datamodel/ui'
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

    return <MuiTextField {...text_props}>{children}</MuiTextField>;
  }
}



export function TemplatedStringcomponentsetting(props:componenentSettingprops)  {
  const {handlerchangewithview,...others}=props
  
  const [uiSetting,setuiSetting]=React.useState(props.uiSetting)
  

  React.useEffect(() => {
    setini();
  }, [props.uiSpec['views']]);

  const changeui = (fields:Array<string>,newvalues:ProjectUIModel,fieldnum:number) => {
    const newfieldlist:Array<string>=[]
    let value:any='αβγ '
    const newini=props.initialValues
        
    for(let i=0;i<fieldnum;i++){
      //get all list field for the uiSpeting
      const name='fieldselect'+1+i+props.fieldName;
      const newfield=generatenewfield('faims-custom','Select',null,name,null)
      const options:Array<option>=[]
      
      fields.map((field:string,index:number)=>props.uiSpec['fields'][field]['component-name']!=='TemplatedStringField'?options[index]={
        value: field,
        label: field,
      }:field)
      newfield['component-parameters']['ElementProps']['options']=options
      newfield['initialValue']=''
      newvalues['fields'][name]=newfield
      newini[name]=''
      newfieldlist[i]=name
      value=value+'{{'+name+'}}-'
      console.log(value)
    }
    newvalues['views']['FormParamater']['fields']=['numberfield'+props.fieldName,...newfieldlist,'template'+props.fieldName];
    newvalues['fields']['template'+props.fieldName]['value']=value
    newini['numberfield'+props.fieldName]=fieldnum
    // newini['template'+props.fieldName]=value
    props.setinitialValues({...newini})
    return newvalues;

  }
  const setini = () =>{
    const options:Array<option>=[]
    //TODO pass the value of all field in this form
    let fields:Array<string>=[]
    props.uiSpec['viewsets'][props.currentform]['views'].map((view:string)=>fields=[...fields,...props.uiSpec['views'][view]['fields']])
    
    if(fields.length>0){
      //get numbers of fields that not IDs
      fields.filter((field:string)=>props.uiSpec['fields'][field]['component-name']!=='TemplatedStringField')
      const numoptions:any=[]
      fields.map((field:string,index:number)=>numoptions[index]={
        value: index+1,
        label: index+1,
      })
      let newvalues:ProjectUIModel=uiSetting
      if(newvalues['fields']['numberfield'+props.fieldName]!==undefined) newvalues['fields']['numberfield'+props.fieldName]['component-parameters']['ElementProps']['options']=numoptions
      let farray:Array<string>=props.uiSpec['fields'][props.fieldName]['component-parameters']['template'].split('-')
      farray=farray.filter((f:string)=>f!=='')
      const num=farray.length>0?farray.length:1
      console.log(num)
      newvalues=changeui(fields,newvalues,num)
      // const newini=props.initialValues
      // newini['numberfield'+props.fieldName]=1
      // props.setinitialValues({...newini})
      setuiSetting({...newvalues})
    }
    console.log(props.initialValues)
    
  }

  const handlerchanges = (event:FAIMSEVENTTYPE) =>{
    const name=event.target.name.replace(props.fieldName,'')
    if(name==='numberfield') {
      let fields:Array<string>=[]
      props.uiSpec['viewsets'][props.currentform]['views'].map((view:string)=>fields=[...fields,...props.uiSpec['views'][view]['fields']])
      if(fields.length>0){
        //get numbers of fields that not IDs
        fields.filter((field:string)=>props.uiSpec['fields'][field]['component-name']!=='TemplatedStringField')
        let newuis:ProjectUIModel=uiSetting
        newuis=changeui(fields,newuis,event.target.value)

        const newuiSpec=props.uiSpec
        newuiSpec['fields'][props.fieldName]['component-parameters']['template']=newuis['fields']['template'+props.fieldName]['value']
        props.setuiSpec({...newuiSpec});
        console.log(newuiSpec)
        
        setuiSetting({...newuis})
      }
    }
    console.log(props.initialValues)
  }


  const handlerchangewithviewSpec = (event:FAIMSEVENTTYPE,view:string) => {
    props.handlerchangewithview(event,view)
    const name=event.target.name.replace(props.fieldName,'')
    if(name.includes('fieldselect1')){
      
      const newvalues=props.uiSpec
      const value=props.uiSpec['fields'][props.fieldName]['component-parameters']['template'].split('-')
      console.log(value)
      const num=name.replace('fieldselect1','')
      value[num]='{{'+event.target.value+'}}'
      let subvalue=value.join('-')
      if(!subvalue.includes('αβγ ')) subvalue='αβγ '+subvalue
      newvalues['fields'][props.fieldName]['component-parameters']['template']=subvalue
      console.log(newvalues['fields'][props.fieldName]['component-parameters']['template'])
      props.setuiSpec({...newvalues});

      const newini=props.initialValues
      newini['template'+props.fieldName]=subvalue
      props.setinitialValues({...newini})
      const newuis=uiSetting
      newuis['fields']['template'+props.fieldName]['value']=subvalue
      console.log('value false')
      console.log(newuis['fields'])
      setuiSetting({...newuis})
    }

    
    
  }


  return (
    <>
    <Defaultcomponentsetting
      handlerchangewithview={handlerchangewithviewSpec}
      handlerchanges={handlerchanges}
      {...others}
      fieldui={props.fieldui}
      uiSetting={uiSetting}
    />
    {props.uiSpec['fields'][props.fieldName]['component-parameters']['template']}
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
    template: 'αβγ {{}}',
    InputProps: {
      type: 'text', // must be a valid html type
    },
    InputLabelProps: {
      label: 'Human Readable ID',
    },
  },
  validationSchema: [['yup.string'], ['yup.required']],
  initialValue: '',
}

function setnewvalue () {
  const field=generatenewfield('faims-custom','Select',null,'name',null)
  return field
}
function getuiSetting  () {
  const newuiSetting:ProjectUIModel=getDefaultuiSetting();
  newuiSetting['fields']['numberfield']={
    'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
    'component-name': 'Select',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'Slect number of Component for This ID field,please enaure to add BasicAutoIncrementer Component',
      variant: 'outlined',
      required: true,
      select: true,
      InputProps: {},
      SelectProps: {},
      ElementProps: {
        options: [
          {
            value: '1',
            label: '1',
          }
        ],
      },
      InputLabelProps: {
        label: 'Number of Field',
      },
    },
    validationSchema: [
      ['yup.string'],
    ],
    initialValue: '1',
  }
  newuiSetting['fields']['template']={
    'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
    'component-name': 'TextField',
    'type-returned': 'faims-core::String', // matches a type in the Project Model
    'component-parameters': {
      fullWidth: true,
      helperText: 'Edit Template Here',
      variant: 'outlined',
      required: false,
      disabled:true,
      InputProps: {
        type: 'text', // must be a valid html type
      },
      SelectProps: {},
      InputLabelProps: {
        label: 'Template',
      },
      FormHelperTextProps: {},
    },
    validationSchema: [
      ['yup.string'],
    ],
    initialValue: '',
  }
  newuiSetting['views']['FormParamater']['fields']=['numberfield','template'];
  newuiSetting["viewsets"]= {
    "settings": {
      "views": [
        "FormParamater",
      ],
      "label": "settings"
    },
  }

  return newuiSetting
}
  
export function getTemplatedStringBuilderIcon() {
  return <LibraryBooksIcon />;
}


export const TemplatedStringSetting =[getuiSetting(),uiSpec]
