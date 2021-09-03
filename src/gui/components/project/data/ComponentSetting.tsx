import {v4 as uuidv4} from 'uuid';

export const FieldModel =(props:any)=>{
	const {name,namespace,component,type_return,required,initialValue,validationSchema,...others}=props
	const uuid=uuidv4()
	let isrequired=false;
	if(required===true) isrequired=required
	let ini=''
	if(initialValue!==undefined) ini=initialValue
	return {
        'component-namespace': namespace, // this says what web component to use to render/acquire value from
        'component-name': component,
        'type-returned': type_return, // matches a type in the Project Model
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
        initialValue:props.initialValue});
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
	// const compoent=compoents[props.type]
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
	'type':fielduiSpec['component-name']}
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
        {name:'',lable:'',type:'TextField'},
        {name:'label',lable:'Label',type:'TextField'},
        {name:'helperText',lable:'Hit Text for Complete Form',type:'TextField'},
        {name:'required',lable:'Check if is compusory',type:'CheckBoxField'},
        {name:'validationSchema',lable:'',type:'TextField'},
        {name:'isaccess',lable:'',type:'CheckBoxField'},
        {name:'field_access',lable:'',type:'TextField'},
        {name:'notes',lable:'put notes',type:'TextField'},
        {name:'meta',lable:'meta input',type:'TextField'}
        ]
	const fields_label:Array<string>=[]
	const fields_list:any={}
	
	fields.map((field,index)=>{
		const fieldname=field.name+`${label}`
		fields_label[index]=fieldname
		if(index===0) { fields_list[fieldname]=component}
		else fields_list[fieldname]=getcomponent(field.type,{'name':fieldname,label:field.lable,initialValue:props[field.name],placeholder:props[field.name]})
		if(field.name==='validationSchema')	console.log(props[field.name])
	})
	return {
		fields:fields_list,
    'views': {
      'start-view': {
        fields:fields_label, 
        uidesign:'settings',
      },
      'next-view-label': 'Done!',
    },

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


export const projectaddfield={
    'fields': {
      'project-design-setion-add-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'project-design-setion-add',
          id: 'project-design-setion-add',
          helperText: 'Enter a string between 2 and 50 characters long',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'text', // must be a valid html type
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Label',
          },
          FormHelperTextProps: {},
        },
        'alert':false,
        validationSchema: [
          ['yup.string'],
          ['yup.min', 0, 'Too Short!'],
          ['yup.max', 50, 'Too Long!'],
        ],
        initialValue: '',
      },
      'project-design-setion-checkvalid-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool', // matches a type in the Project Model
        'component-parameters': {
          name: 'project-design-setion-checkvalid',
          id: 'project-design-setion-checkvalid',
          required: false,
          type: 'checkbox',
          FormControlLabelProps: {
            label: 'Validate this field',
          },
          FormHelperTextProps: {
            children: '',
          },
          // Label: {label: 'Terms and Conditions'},
        },
        'alert':false,
        validationSchema: [
          ['yup.bool'],
        ],
        initialValue: false,
      },
      'project-design-setion-valid-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'project-design-setion-valid',
          id: 'project-design-setion-valid',
          helperText: '',
          variant: 'outlined',
          required: false,
          multiline: true,
          InputProps: {
            type: 'text',
            rows: 3,
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Description',
          },
          FormHelperTextProps: {},
        },
        'alert':'Please follow the format',
        validationSchema: [['yup.string']],
        initialValue:'',
      },'project-design-setion-checksetting-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool', // matches a type in the Project Model
        'component-parameters': {
          name: 'project-design-setion-checksetting',
          id: 'project-design-setion-checksetting',
          required: false,
          type: 'checkbox',
          FormControlLabelProps: {
            label: 'Settings',
          },
          FormHelperTextProps: {
            children: '',
          },
          // Label: {label: 'Terms and Conditions'},
        },
        'alert':false,
        validationSchema: [
          ['yup.bool'],
        ],
        initialValue: false,
      },
      'project-design-setion-setting-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'project-design-setion-setting',
          id: 'project-design-setion-setting',
          helperText: '',
          variant: 'outlined',
          required: false,
          multiline: true,
          InputProps: {
            type: 'text',
            rows: 3,
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Settings',
          },
          FormHelperTextProps: {},
        },
        'alert':'Please follow the format',
        validationSchema: [['yup.string']],
        initialValue:'',
      },'project-design-setion-checkemail-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool', // matches a type in the Project Model
        'component-parameters': {
          name: 'project-design-setion-checkemail',
          id: 'project-design-setion-checkemail',
          required: false,
          type: 'checkbox',
          FormControlLabelProps: {
            label: 'Allow only centain users to see this field',
          },
          FormHelperTextProps: {
            children: '',
          },
          // Label: {label: 'Terms and Conditions'},
        },
        'alert':false,
        validationSchema: [
          ['yup.bool'],
        ],
        initialValue: false,
      },
      'project-design-setion-add-email-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::Email', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'project-design-setion-add-email',
          id: 'project-design-setion-add-email',
          helperText: 'Please provide a valid email address',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'email',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Email Address',
          },
          FormHelperTextProps: {},
        },
        'alert':'any email address added here will be automatically added to INVITE tab',
        validationSchema: [
          ['yup.string'],
          ['yup.email', 'Enter a valid email'],
        ],
        initialValue: '',
      }
    },
    'views': {
      'start-view': {
        fields: [
          'project-design-setion-add-field',
          'project-design-setion-checksetting-field',
          'project-design-setion-setting-field',
          'project-design-setion-checkvalid-field',
          'project-design-setion-valid-field',
          'project-design-setion-checkemail-field',
          'project-design-setion-add-email-field',
        ], 
        uidesign:'design',
      },
      'next-view-label': 'Done!',
    },

    'start_view': 'start-view'
  }

export function generateaddfieldui(){
	return true;
}

