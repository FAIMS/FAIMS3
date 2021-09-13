import {v4 as uuidv4} from 'uuid';
const accessgroup=['admin','moderator','team']
export const FieldModel =(props:any)=>{
	const {name,namespace,component,type_return,required,initialValue,validationSchema,meta_note,meta_type,access,...others}=props
	let isrequired=false;
	if(required===true) isrequired=required
	return {
        'component-namespace': namespace, // this says what web component to use to render/acquire value from
        'component-name': component,
        'type-returned': type_return, // matches a type in the Project Model
        'meta':{note:meta_note??'',type:meta_type??''},
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
	return FieldModel({namespace:'formik-material-ui',type_return:'faims-core::String',component:'TextField',
		InputProps: {
            type: 'text',
          },fullWidth: true,placeholder:props.placeholder,
		name:props.name,required:props.required,validationSchema:[['yup.string'],],
        helperText:props.helperText,InputLabelProps: {
            label: props.label,
          },
        initialValue:props.initialValue,meta_note:props.meta_note,meta_type:props.meta_type,access:props.access});
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
	'label':fielduiSpec['component-parameters']['InputLabelProps']['label'],
	'helperText':fielduiSpec['component-parameters']['InputLabelProps']['helperText'],
	// 'validationSchema':fielduiSpec['validationSchema'],
	'initialValue':fielduiSpec['initialValue'],
	'required':fielduiSpec['component-parameters']['required'],
	'type':fielduiSpec['component-name'],
	'meta_note':fielduiSpec['meta']['note'],
	'meta_type':fielduiSpec['meta']['type'],
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
        {name:'meta_note',lable:'put notes',type:'TextField',view:'notes'},
        {name:'meta_type',lable:'Uncertain',type:'TextField',view:'notes'},

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
	tabs.map((tab:string)=> fields_list[tab]=getcomponent('TextField',{name:tab, lable:tab, initialValue:tab, placeholder:tab}));
	return {
		fields:fields_list,
    'views':{'start-view':{fields:tabs}} ,
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


