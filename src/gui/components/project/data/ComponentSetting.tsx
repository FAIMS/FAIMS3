import {v4 as uuidv4} from 'uuid';

export const FieldModel =(props:any)=>{
	const {name,namespace,component,type_return,required,initialValue,validationSchema,meta,access,...others}=props
	const uuid=uuidv4()
	let isrequired=false;
	if(required===true) isrequired=required
	let ini=''
	if(initialValue!==undefined) ini=initialValue
	return {
        'component-namespace': namespace, // this says what web component to use to render/acquire value from
        'component-name': component,
        'type-returned': type_return, // matches a type in the Project Model
        'meta':meta,
        'access':access,
        'component-parameters': {
          name: name,
          id: name,          
          variant: 'outlined',
          required: isrequired,          
          ...others
        },
        'alert':false,
        validationSchema: validationSchema,
        initialValue: ini,
      }
}
const TextField=(props:any)=> {
	return FieldModel({namespace:'formik-material-ui',type_return:'faims-core::String',component:'TextField',
		InputProps: {
            type: 'text',
          },fullWidth: true,placeholder:props.placeholder,
		name:props.name,required:props.required,validationSchema:[
          ['yup.string'],
          ['yup.min', 0, 'Too Short!'],
          ['yup.max', 50, 'Too Long!'],
        ],
        helperText:props.helperText,InputLabelProps: {
            label: props.label,
          },
        initialValue:props.initialValue,meta:props.meta,access:props.access});
	}
const CheckboxField=(props:any)=> {
	return FieldModel({namespace:'faims-custom',type_return:'faims-core::Bool',component:'Checkbox',type:'checkbox',validationSchema:[
          ['yup.bool'],
        ],FormControlLabelProps: {
            label: props.label,
          },initialValue:false,name:props.name,FormHelperTextProps: {children:props.helperText}});
	}

const compoents={
	'TextField':TextField,
	'CheckboxField':CheckboxField,
}

export const getcomponent=(type:string,props:any)=>{
	if(type==='CheckBoxField') return CheckboxField(props);
	return TextField(props);
}
export const updatecomponent=(component:any,props:any)=>{
	//{...compoent,props.type:props.value}
	return false;
}
export const convertuiSpecToProps =(fielduiSpec:any) =>{
	const props:any={'name':fielduiSpec['component-parameters']['name'],
	'label':fielduiSpec['component-parameters']['InputLabelProps']['label'],
	'helperText':fielduiSpec['component-parameters']['InputLabelProps']['helperText'],
	// 'validationSchema':fielduiSpec['validationSchema'],
	'initialValue':fielduiSpec['initialValue'],
	'required':fielduiSpec['component-parameters']['required'],
	'type':fielduiSpec['component-name'],
	'meta':fielduiSpec['meta'],
	'access':fielduiSpec['access'],
	}
	return props;
}
export const convertSettingTouiSpec = (props:any) =>{
	return '';
}

export const getfieldname = (name:string,label:string) =>{
	const names=name.split(label);
	if(names.length>1)
		return {'type':names[0],'name':label+names[1],'index':names[1]};
	return {'type':'','name':'',index:0};
}
//Add new field form or convert uiSpec to setting form convertuiSpectoSetting
export const FieldSettings=(component:any,label:string,props:any)=>{
	const fields=[
        {name:'',lable:'',type:'TextField',view:'start-view'},
        {name:'label',lable:'Label',type:'TextField',view:'settings'},
        {name:'helperText',lable:'Hit Text for Complete Form',type:'TextField',view:'settings'},
        {name:'required',lable:'Check if is compusory',type:'CheckBoxField',view:'valid'},
        {name:'validationSchema',lable:'',type:'TextField',view:'valid'},
        // {name:'isaccess',lable:'',type:'CheckBoxField',view:'access'},
        {name:'access',lable:'access',type:'TextField',view:'access'},
        {name:'meta',lable:'put notes',type:'TextField',view:'notes'},

        ]
	const fields_label:Array<string>=[]
	const fields_list:any={}
	const view_list=['settings','valid','access','notes']
	const views:any={'start-view':{fields:[],uidesign:'settings'}}
	view_list.map(view=>views[view]={fields:[],uidesign:'settings'}
		)
	// const views:any={'start-view':{fields:[],uidesign:'settings'},
	// 'settings':{fields:[],uidesign:'settings'},'valid':{fields:[],uidesign:'settings'},'access':{fields:[],uidesign:'settings'},'notes':{fields:[],uidesign:'settings'}}
	
	fields.map((field,index)=>{
		const fieldname=field.name+`${label}`
		fields_label[index]=fieldname
		if(index===0) { 
			fields_list[fieldname]=component;
			const view=field.view
			views[view]['fields'][0]=fieldname
			views[view]['uidesign']='settings'
		}else {
			fields_list[fieldname]=getcomponent(field.type,{'name':fieldname,label:field.lable,initialValue:props[field.name],placeholder:props[field.name]});
			const view=field.view
			views[view]['fields']=[...views[view]['fields'],fieldname]
			views[view]['uidesign']='settings'
		}
	})
	return {
		fields:fields_list,
    'views':views ,
    'view_list':view_list,
    // 'views':{
    	
    //   'start-view': {
    //     fields:fields_label, 
    //     uidesign:'settings',
    //   },
    //   'next-view-label': 'Done!',
    // },

    'start_view': 'start-view'

	}
	
}

 export const setProjectInitialValues = (uiSpec:any,currentView:string,initialValues: {[key: string]: any}) => {
    const existingData: {
      [viewName: string]: {[fieldName: string]: unknown};
    } = {};
    const fields = uiSpec['fields'];
    const fieldNames = uiSpec['views'][currentView]['fields'];
    fieldNames.forEach((fieldName:any) => {
      initialValues[fieldName] =
        existingData?.[fieldName] ||
        fields[fieldName]['initialValue'];
    });
    return initialValues;
  }



export function generateaddfieldui(){
	return true;
}

