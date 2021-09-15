import {v4 as uuidv4} from 'uuid';
const accessgroup=['admin','moderator','team']
export const FieldModel =(props:any)=>{
	const {name,namespace,component,type_return,required,initialValue,validationSchema,annotation_label,meta_type,meta_type_label,access,...others}=props
	let isrequired=false;
	if(required===true) isrequired=required
	return {
        'component-namespace': namespace, // this says what web component to use to render/acquire value from
        'component-name': component,
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
const TextField=(props:any)=> {
	const {label,helperText,validationSchema,initialValuename,...others}=props;
	//annotation_label:props.annotation_label,meta_type:props.meta_type,meta_type_label:props.meta_type_label,access:props.access,props.name,required:props.required,placeholder:props.placeholder,
	return FieldModel({namespace:'formik-material-ui',type_return:'faims-core::String',component:'TextField',
		InputProps: {
            type: 'text',
          },fullWidth: true,
		validationSchema:[validationSchema??['yup.string'],],
        helperText:helperText,InputLabelProps: {
            label: label,
          },initialValue:initialValuename,...others});
	}
const CheckboxField=(props:any)=> {
	const {label,helperText,validationSchema,initialValuename,...others}=props;
	return FieldModel({namespace:'faims-custom',type_return:'faims-core::Bool',component:'Checkbox',type:'checkbox',validationSchema:[
          validationSchema??['yup.bool'],
        ],FormControlLabelProps: {
            label:label,
          },initialValue:false,FormHelperTextProps: {children:helperText??''}});
	}

const compoents={
	'TextField':TextField,
	'CheckboxField':CheckboxField,
}

export const getid = ()=>{
	return uuidv4().split('-')[0];
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
	'label':fielduiSpec['component-name']==="TextField"?fielduiSpec['component-parameters']['InputLabelProps']['label']:fielduiSpec['component-parameters']['FormControlLabelProps']['label'],
	'helperText':fielduiSpec['component-name']==="TextField"?fielduiSpec['component-parameters']['InputLabelProps']['helperText']:fielduiSpec['component-parameters']['FormHelperTextProps']['children'],	// 'validationSchema':fielduiSpec['validationSchema'],
	'initialValue':fielduiSpec['initialValue'],
	'required':fielduiSpec['component-parameters']['required'],
	'type':fielduiSpec['component-name'],
	'meta_annotation_label':fielduiSpec['meta']['annotation_label'],
	'meta_type':fielduiSpec['meta']['uncertainty']['include'],
	'meta_type_label':fielduiSpec['meta']['uncertainty']['label'],
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
        {name:'',lable:'',type:'TextField',view:'general'},
        {name:'label',lable:'Label',type:'TextField',view:'settings'},
        {name:'helperText',lable:'Hit Text for Complete Form',type:'TextField',view:'settings'},
        {name:'required',lable:'Check if is compusory',type:'CheckBoxField',view:'valid'},
        {name:'validationSchema',lable:'',type:'TextField',view:'valid'},
        {name:'access',lable:'access',type:'TextField',view:'access'},
        {name:'annotation_label',lable:'annotation Label',type:'TextField',view:'notes'},
        {name:'meta_type',lable:'Include Uncertainty',type:'CheckBoxField',view:'notes'},
        {name:'meta_type_label',lable:'Uncertainty Label',type:'TextField',view:'notes'},

        ]
	const fields_label:Array<string>=[]
	const fields_list:any={}
	const view_list=['settings','valid','access','notes','general']
	const views:any={'start-view':{fields:[],uidesign:'settings'}}
	view_list.map(view=>views[view]={fields:[],uidesign:'settings'})
	fields.map((field,index)=>{
		const fieldname=field.name+`${label}`
		fields_label[index]=fieldname
		if(index===0) { 
			fields_list[fieldname]=component;
		}else {
			fields_list[fieldname]=getcomponent(field.type,{'name':fieldname,label:field.lable,initialValue:props[field.name],placeholder:props[field.name]!==undefined?props[field.name].toString():field.name});
		}
		const view=field.view
			views[view]['fields']=[...views[view]['fields'],fieldname]
			views[view]['uidesign']='settings'
		
	})
	views['start-view']={'fields':fields_label,'uidesign':'settings'}
	return {
		fields:fields_list,
    'views':views ,
    'view_list':view_list,
    'start_view': 'start-view'

	}
}

export const gettabform = (tabs:Array<string>) =>{
	const fields_list:any={}
	const fields:Array<string>=[]

	tabs.map((tab:string,index:number)=> {fields_list['formelement'+index]=getcomponent('TextField',{name:'formelement'+index, lable:tab, initialValue:tab, placeholder:tab}); fields[index]='formelement'+index
		});

	return {
		fields:fields_list,
    'views':{'start-view':{fields:fields}} ,
    'start_view': 'start-view'
	}
}

 export const setProjectInitialValues = (uiSpec:any,currentView:string,initialValues: any) => {
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


export const sampleuispec={
  "fields": {
    "newfield365bcf6d": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "meta": {
        "note": "te",
        "type": "uncertain"
      },
      "access": [
        "admin",
        "moderator",
        "team"
      ],
      "component-parameters": {
        "name": "newfield365bcf6d",
        "id": "newfield365bcf6d",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "fullWidth": true,
        "InputLabelProps": {
          "label": "label1"
        }
      },
      "alert": false,
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": ""
    },
    "newfield0ed561ba": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "meta": {
        "note": "",
        "type": ""
      },
      "access": [
        "admin",
        "moderator",
        "team"
      ],
      "component-parameters": {
        "name": "newfield0ed561ba",
        "id": "newfield0ed561ba",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "fullWidth": true,
        "InputLabelProps": {
          "label": "second"
        }
      },
      "alert": false,
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": ""
    },
    "newfield7e43e210": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "meta": {
        "note": "",
        "type": ""
      },
      "access": [
        "admin",
        "moderator",
        "team"
      ],
      "component-parameters": {
        "name": "newfield7e43e210",
        "id": "newfield7e43e210",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "fullWidth": true,
        "InputLabelProps": {
          "label": "photolog1"
        }
      },
      "alert": false,
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": ""
    },
    "newfieldae52f0a8": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "meta": {
        "note": "",
        "type": ""
      },
      "access": [
        "admin",
        "moderator",
        "team"
      ],
      "component-parameters": {
        "name": "newfieldae52f0a8",
        "id": "newfieldae52f0a8",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "fullWidth": true,
        "InputLabelProps": {
          "label": "phtotolog2"
        }
      },
      "alert": false,
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": ""
    },
    "newfieldc5cb35eb": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "meta": {
        "note": "",
        "type": ""
      },
      "access": [
        "admin",
        "moderator",
        "team"
      ],
      "component-parameters": {
        "name": "newfieldc5cb35eb",
        "id": "newfieldc5cb35eb",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "fullWidth": true,
        "InputLabelProps": {
          "label": "phot3"
        }
      },
      "alert": false,
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": ""
    }
  },
  "views": {
    "mainsection1": {
      "fields": [
        "newfield365bcf6d"
      ],
      "uidesign": "form"
    },
    "mainsection2": {
      "fields": [
        "newfield0ed561ba"
      ],
      "uidesign": "form"
    },
    "photologsection3": {
      "fields": [
        
      ],
      "uidesign": "form"
    },
    "photologsection4": {
      "fields": [
        
      ],
      "uidesign": "form"
    }
  },
  "viewsets": {
    "main": {
      "views": [
        "mainsection1",
        "mainsection2"
      ]
    },
    "photolog": {
      "views": [
        "photologsection3",
        "photologsection4"
      ]
    }
  },
  "visible_types": [
    "main",
    "photolog"
  ]}


