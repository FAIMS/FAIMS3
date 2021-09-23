import {getComponentByName,getComponentPropertiesByName} from '../../../component_registry';

// export function setupComponentuiSpec(props:any
//   ):string{
//   const uiSpec=
//   return uiSpec;
// }
export const fields=
    [{name:'Text',des:'text plus sepcial characters',...getComponentPropertiesByName('formik-material-ui','TextField'),id:{namespace:'formik-material-ui',componentName:'TextField'}},
    // {name:'Checkbox',des:'text plus sepcial characters',id:'CheckBox',...getComponentPropertiesByName('formik-material-ui','TextField')},
    // {name:'MultiText',des:'text plus sepcial characters',id:'MultiTextField',...getComponentPropertiesByName('formik-material-ui','TextField')},
    // {name:'Email',des:'text plus sepcial characters',id:'EmailField',...getComponentPropertiesByName('formik-material-ui','TextField')},
    // {name:'Integer',des:'text plus sepcial characters',id:'IntegerField',...getComponentPropertiesByName('formik-material-ui','TextField')},
    // {name:'Select',des:'text plus sepcial characters',id:'SelectBox',...getComponentPropertiesByName('formik-material-ui','TextField')},
    // {name:'MutiSelect',des:'text plus sepcial characters',id:'MutiSelectBox',...getComponentPropertiesByName('formik-material-ui','TextField')}
    ]


const componentarray=[{namespace:'formik-material-ui',componentName:'TextField'}]
const accessgroup=['admin','moderator','team']

export const getcomponent=(preprops:any)=>{
    const props={...preprops,namespace:'formik-material-ui',componentName:'TextField'}
    // if(type==='CheckBox'||type==='checkbox') return Checkbox(props);
    // if(type==='EmailField') return EmailField(props);
    // if(type==='MultiTextField') return MultiTextField(props);
    // if(type==='IntegerField'||type==='number') return IntegerField(props);
    // if(type==='SelectBox'||type==='Select'||type==='select') return SelectBox(props);
    // if(type==='MutiSelectBox') return MutiSelectBox(props);
    return TextField(props);
}

export const getsettingform = (component:string) =>{
    if(component==='Select')  return [{name:'options',lable:'options',type:'TextField',view:'settings'}]
    if(component==='MultiTextField') return [{name:'multirows',lable:'Number of rows',type:'IntegerField',view:'settings'}]
    return []
}

// export const updatecomponent=(component:any,props:any)=>{
//     //{...compoent,props.type:props.value}
//     return false;
// }
export const convertuiSpecToProps =(fielduiSpec:any) =>{
    const props:any={
    'component-name':fielduiSpec['component-name'],
    'name':fielduiSpec['component-parameters']['name'],
    'label':["TextField","Select"].includes(fielduiSpec['component-name'])?fielduiSpec['component-parameters']['InputLabelProps']['label']:fielduiSpec['component-parameters']['FormControlLabelProps']['label'],//fielduiSpec['component-parameters']['FormControlLabelProps']['label']
    'helperText':["TextField","Select"].includes(fielduiSpec['component-name'])?fielduiSpec['component-parameters']['InputLabelProps']['helperText']:'',   // 'validationSchema':fielduiSpec['validationSchema'],fielduiSpec['component-parameters']['FormHelperTextProps']['children']
    'initialValue':fielduiSpec['initialValue'],
    'required':fielduiSpec['component-parameters']['required'],
    'type':fielduiSpec['component-parameters']['InputProps']!==undefined?fielduiSpec['component-parameters']['InputProps']['type']:fielduiSpec['component-parameters']['type'],
    'annotation_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['annotation_label']:'annotation',
    'meta_type':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['include']:false,
    'meta_type_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['label']:'',
    'access':fielduiSpec['access'],
    'multiline':fielduiSpec['component-parameters']['multiline']??false,
    'multselect':fielduiSpec['component-name']==='Select'?fielduiSpec['component-parameters']['SelectProps']['multiple']:false,
    'multirows':fielduiSpec['component-parameters']['multiline']!==undefined&&fielduiSpec['component-parameters']['multiline']!==false?fielduiSpec['component-parameters']['InputProps']['rows']:1,
    }
    return props;
}


const FieldModel =(props:any)=>{
	const {name,namespace,componentName,type_return,required,initialValue,validationSchema,multi,multirows,options,annotation_label,multselect,meta_type,meta_type_label,access,...others}=props
	let isrequired=false;
	if(required===true) isrequired=required
	return {
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
}

const getspec = (type:string) => {
    if(type==='EmailField') return {type_return:'faims-core::Email',validationSchema:[['yup.string'],['yup.email', 'Enter a valid email']],type:'email'} 
    if(type==='IntegerField') return {type_return:'faims-core::Integer',validationSchema:[['yup.number'],],type:'number'}
    if(type==='SelectBox') return {type_return:'faims-core::Integer',validationSchema:[['yup.number'],],type:'number'}
    return {type_return:'faims-core::String',validationSchema:[['yup.string'],],type:'text'}
}
const TextFieldslist = (type:string,props:any) =>{
    const {label,helperText,validationSchema,initialValue,...others}=props;
    const spec=getspec(type)
    return FieldModel({
        namespace:props.namespace,
        type_return:spec.type_return,
        componentName:props.componentName,
        InputProps: {
            type: spec.type,
            rows: props.multirows??1,
          },
        fullWidth: true,
        multiline: props.multi??false,
        validationSchema:validationSchema??spec.validationSchema,
        helperText:helperText,
        InputLabelProps: {
            label: label,
          },
        initialValue:initialValue,
        ...others}); 
}

const TextField=(props:any)=> {
	return TextFieldslist('TextField',props)
	}


const EmailField=(props:any)=> {
  return TextFieldslist('EmailField',props)
  }

const MultiTextField=(props:any)=> {
    const newprops=props
    newprops.multi=true;
    newprops.multirows=4;
    return TextFieldslist('MultiTextField',newprops)
  }

const IntegerField=(props:any)=> {
  return TextFieldslist('IntegerField',props)
  }

const Checkbox=(props:any)=> {
	const {label,helperText,validationSchema,initialValue,...others}=props;
	return FieldModel({namespace:'faims-custom',type_return:'faims-core::Bool',component:'Checkbox',type:'checkbox',validationSchema:[
          validationSchema??['yup.bool'],
        ],FormControlLabelProps: {
            label:label,
          },initialValue:false,FormHelperTextProps: {children:helperText??''},...others});
	}

const SelectBox=(props:any)=> {
    const {label,helperText,validationSchema,initialValue,...others}=props;
    const newprops=props;
    const options=[{
                value: 'Default',
                label: 'Default',
              }]
    newprops.select=true
    newprops.SelectProps={multiple: props.multselect??false,}
    newprops.ElementProps={options:props.options??options}
    return TextFieldslist('IntegerField',props);
    }
const MutiSelectBox=(props:any) =>{
    const newprops=props;
    newprops.multselect=true;
    newprops.initialValue=['Default'];
    return SelectBox(newprops);
}


const compoents={
    'TextField':TextField,
    'CheckBox':Checkbox,
}



