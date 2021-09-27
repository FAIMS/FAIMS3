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
 * Filename: uiFieldsRegistry.tsx
 * Description:
 *   TODO: ADD function to pass and update validationschema
 *   TODO: ADD function to pass and update access
 *   TODO: function getfields Field icon not working
 */

import {getComponentByName,getComponentPropertiesByName} from '../../../component_registry';

type componentlist={namespace:string;componentName:string;props?:any}

const componentarray:Array<componentlist>=[
{namespace:'formik-material-ui',componentName:'TextField'},
{namespace:'faims-custom',componentName:'Select'},
{namespace:'faims-custom',componentName:'ActionButton'},
{namespace:'faims-custom',componentName:'TakePoint'},
{namespace:'faims-custom',componentName:'TemplatedStringField'}]

export const getfields = () => {
    const fields:any={}
    let fieldtabs:Array<string>=[]
    componentarray.map((component:componentlist)=>{
        const props=getComponentPropertiesByName(component.namespace,component.componentName)
        if(!fieldtabs.includes(props.componentname)) {
            fields[props.componentname]=[{...props}]
            fieldtabs=[...fieldtabs,props.componentname]
        }
        else fields[props.componentname]=[...fields[props.componentname],{...props}]
    }
    )

    return {fields,fieldtabs};
}
const accessgroup=['admin','moderator','team']

export const getcomponent=(props:any)=>{

    if(props.namespace===undefined) {
        const newprops=getComponentPropertiesByName('formik-material-ui','TextField');
        return TextField({...props,...newprops['uiSpecProps']})
    } 
    if(props.componentName==='Checkbox') return Checkbox(props);
    if(props.componentName==='TakePoint') return SpecialField(props);
    if(props.componentName==='TextField'||props.componentName==='Select') return TextField(props);
    return SpecialField(props);

}

export const getsettingform = (component:any) =>{
    if(component['component-name']==='Select')  return [{name:'options',lable:'options',type:'TextField',view:'settings'}]
    if(component['component-parameters']['multiline']===true) return [{name:'multirows',lable:'Number of rows',type:'IntegerField',view:'settings'}]
    return []
}


export const convertuiSpecToProps =(fielduiSpec:any) =>{
    const {name,select,helperText,InputLabelProps,InputProps,FormHelperTextProps,ElementProps,SelectProps,required,...others}=fielduiSpec['component-parameters']
    let props:any={} //TODO: add extend filed here from component Specfic
    props={...others,...{
    'componentName':fielduiSpec['component-name'],
    'namespace':fielduiSpec['component-namespace'],
    'name':fielduiSpec['component-parameters']['name'],
    'type_return':fielduiSpec['type-returned'],
    'required':fielduiSpec['component-parameters']['required'],
    'initialValue':fielduiSpec['initialValue'],
    //'validationSchema':fielduiSpec['validationSchema'],  TODO: ADD function to pass and update validationschema
    'annotation_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['annotation_label']:'annotation',
    'meta_type':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['include']:false,
    'meta_type_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['label']:'',
    'access':fielduiSpec['access'],  //TODO: ADD function to pass and update access
    'select':fielduiSpec['component-parameters']['select']===true?true:false,
    'label':fielduiSpec['component-parameters']['InputLabelProps']!==undefined?fielduiSpec['component-parameters']['InputLabelProps']['label']:fielduiSpec['component-parameters']['FormControlLabelProps']!==undefined?fielduiSpec['component-parameters']['FormControlLabelProps']['label']:'',//fielduiSpec['component-parameters']['FormControlLabelProps']['label']
    'helperText':fielduiSpec['component-parameters']['helperText']!==undefined?fielduiSpec['component-parameters']['helperText']:fielduiSpec['component-parameters']['FormHelperTextProps']['children'],   // 'validationSchema':fielduiSpec['validationSchema'],fielduiSpec['component-parameters']['FormHelperTextProps']['children'] 
    'type':fielduiSpec['component-parameters']['InputProps']!==undefined?fielduiSpec['component-parameters']['InputProps']['type']:fielduiSpec['component-parameters']['type'],
    'multiline':fielduiSpec['component-parameters']['multiline']===true?true:false,
    'multselect':fielduiSpec['component-name']==='Select'?fielduiSpec['component-parameters']['SelectProps']['multiple']:false,
    'multirows':fielduiSpec['component-parameters']['multiline']!==undefined&&fielduiSpec['component-parameters']['multiline']!==false?fielduiSpec['component-parameters']['InputProps']['rows']:1,
    }}
    if(fielduiSpec['component-parameters']['select']===true)
    props['options']=fielduiSpec['component-parameters']['ElementProps']['options']
    
    return props;
}


const FieldModel =(props:any)=>{
	const {name,namespace,componentName,type_return,required,initialValue,validationSchema,multiline,multirows,select,options,multselect,annotation_label,meta_type,meta_type_label,access,...others}=props
	let isrequired=false;
	if(required===true) isrequired=required
	const uiSpec={
        'component-namespace': namespace, // this says what web component to use to render/acquire value from
        'component-name': componentName,
        'type-returned': type_return, // matches a type in the Project Model
        'meta':{annotation_label:annotation_label??'annotation',uncertainty:{include:meta_type??false,label:meta_type_label??'uncertainty'}},
        'access':access??accessgroup,
        'component-parameters': {
          name: name,
          id: name,          
          variant: 'outlined',
          required: isrequired,
          ...others
        },
        'alert':false,
        validationSchema: validationSchema??[],
        initialValue: initialValue??'',
      }
      if(select===true) {
        uiSpec['component-parameters']['select']=true
        uiSpec['component-parameters']['ElementProps']={options:options??[{
                value: 'Default',
                label: 'Default',
              }]}
        uiSpec['component-parameters']['SelectProps']={multiple: props.multselect??false,}
    if(props.multselect===true) uiSpec.initialValue=initialValue??['']

        }
    if(componentName==='TakePoint') uiSpec.initialValue=initialValue??null
    return uiSpec
}

const getspec = (type:string) => {
    if(type==='EmailField') return {type_return:'faims-core::Email',validationSchema:[['yup.string'],['yup.email', 'Enter a valid email']],type:'email'} 
    if(type==='IntegerField') return {type_return:'faims-core::Integer',validationSchema:[['yup.number'],],type:'number'}
    if(type==='SelectBox') return {type_return:'faims-core::Integer',validationSchema:[['yup.number'],],type:'number'}
    return {type_return:'faims-core::String',validationSchema:[['yup.string'],],type:'text'}
}
const TextField = (props:any) =>{
    const {label,helperText,validationSchema,initialValue,...others}=props;
    return FieldModel({
        namespace:props.namespace,
        type_return:props.type_return,
        componentName:props.componentName,
        InputProps: {
            type: props.type,
            rows: props.multirows??1,
          },
        fullWidth: true,
        multiline: props.multiline??false,
        validationSchema:validationSchema??props.validationSchema,
        helperText:helperText??'',
        InputLabelProps: {
            label: label,
          },
        initialValue:initialValue,
        ...others}); 
}

const SpecialField = (props:any) =>{
    const {label,helperText,validationSchema,initialValue,...others}=props;
    return FieldModel({
        namespace:props.namespace,
        type_return:props.type_return,
        componentName:props.componentName,
        fullWidth: true,
        validationSchema:validationSchema??props.validationSchema,
        helperText:helperText??'',
        initialValue:initialValue,
        ...others}); 
}

// const TextField=(props:any)=> {
// 	return TextFieldslist('TextField',props)
// 	}


// const EmailField=(props:any)=> {
//   return TextFieldslist('EmailField',props)
//   }

// const MultiTextField=(props:any)=> {
//     const newprops=props
//     newprops.multiline=true;
//     newprops.multirows=4;
//     return TextFieldslist('MultiTextField',newprops)
//   }

// const IntegerField=(props:any)=> {
//   return TextFieldslist('IntegerField',props)
//   }

const Checkbox=(props:any)=> {
	const {label,helperText,validationSchema,initialValue,...others}=props;
	return FieldModel({namespace:'faims-custom',type_return:'faims-core::Bool',componentName:'Checkbox',type:'checkbox',validationSchema:[
          validationSchema??['yup.bool'],
        ],FormControlLabelProps: {
            label:label,
          },initialValue:false,FormHelperTextProps: {children:helperText??''},...others});
	}


// const MutiSelectBox=(props:any) =>{
//     const newprops=props;
//     newprops.multselect=true;
//     newprops.initialValue=['Default'];
//     return SelectBox(newprops);
// }


const compoents={
    'TextField':TextField,
    'CheckBox':Checkbox,
}



