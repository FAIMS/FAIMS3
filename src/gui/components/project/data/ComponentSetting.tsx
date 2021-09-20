import {v4 as uuidv4} from 'uuid';
const accessgroup=['admin','moderator','team']
const VISIBLE_TYPE='visible_types'
const NEWFIELDS='newfield'

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
	'label':fielduiSpec['component-name']==="TextField"?fielduiSpec['component-parameters']['InputLabelProps']['label']:'',//fielduiSpec['component-parameters']['FormControlLabelProps']['label']
	'helperText':fielduiSpec['component-name']==="TextField"?fielduiSpec['component-parameters']['InputLabelProps']['helperText']:'',	// 'validationSchema':fielduiSpec['validationSchema'],fielduiSpec['component-parameters']['FormHelperTextProps']['children']
	'initialValue':fielduiSpec['initialValue'],
	'required':fielduiSpec['component-parameters']['required'],
	'type':fielduiSpec['component-name'],
	'meta_annotation_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['annotation_label']:'annotation',
	'meta_type':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['include']:false,
	'meta_type_label':fielduiSpec['meta']!==undefined?fielduiSpec['meta']['uncertainty']['label']:'',
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

export const getprojectform= (tabs:Array<string>) =>{
  const fields_list:any={}
  const fields:Array<string>=[]

  tabs.map((tab:string,index:number)=> {fields_list[tab]=getcomponent('TextField',{name:tab, lable:tab, initialValue:'', placeholder:''}); fields[index]=tab
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




export const updateuiSpec = (type:string,props:any) =>{
  const newuiSpec=props.formuiSpec
  const newformcom=props.formcomponents
  switch (type) {
    case 'formvariantsupdate':
      return updatelabel(true,props);
    case 'formvsectionupdate':
      return updatelabel(false,props);
    case 'formvariantsadd':
      return formvariantsadd(props);
    case 'formvsectionadd':
      return formvsectionadd(props)
    case 'newfromui':
      return newfromui(props.formuiSpec,props.formcomponents);
    case 'switch':
      return swithField(props.index,props.type,props.formuiSpec,props.formcomponents,props.formuiview)
    case 'removefield':
      console.log('run here')
      return removefield(props.index,props.formuiSpec,props.formcomponents,props.formuiview);
    case 'addfield':
      return addfield(props);
    case 'updatefield':
      return updatefield(props);
    default: 
      return newuiSpec;
    }
}

const updatelabel = (type:boolean,props:any) =>{
  const newviews=props.formuiSpec
  const components=props.formcomponents
  props.tabs.map((tab:string,index:number)=>{
    if(type){
      //update form label
      const tabid=newviews[VISIBLE_TYPE][index]
      newviews['viewsets'][tabid]['label']=tab
    }else{
      const tabid=newviews['viewsets'][props.formvariants]['views'][index]
      newviews['views'][tabid]['label']=tab
    }
    
  })
  return {newviews,components}
}

const newfromui = (newuiSpec:any,newformcom:any) =>{
  newuiSpec[VISIBLE_TYPE].map((variant:any,index:any)=>{
        if(index===0)
        newuiSpec['viewsets'][variant]['views'].map((view:string)=>{
          newformcom[view]=[]    
          newuiSpec['views'][view]['fields'].map((fieldname:string)=>{
            console.log(fieldname)
            const field=newuiSpec['fields'][fieldname]
            const fieldprops=convertuiSpecToProps(field)
            const newuiSpeclist=FieldSettings(field,fieldname,fieldprops)
            newformcom[view]=[...newformcom[view],{id:fieldname.replace(NEWFIELDS,''),uiSpec:newuiSpeclist,designvalue:'settings'}];
          })
        })
      })
  return {uiSpec:newuiSpec,formcomponents:newformcom};
}

 const swithField = (index:any,type:boolean,formuiSpec:any,formcomponents:any,formuiview:string) =>{
      const newviews=formuiSpec
      const components=formcomponents
      const fields=formuiSpec['views'][formuiview]['fields']
      const field=fields[index]
      const component=formcomponents[formuiview][index]
      fields.splice(index,1)
      components[formuiview].splice(index,1)
      if(type) index=index+1 //down
      else index=index-1 //up
      fields.splice(index,0,field)
      components[formuiview].splice(index,0,component)
      newviews['views'][formuiview]['fields']=fields
      return {newviews,components}
      
    }
const removefield = (id:string,formuiSpec:any,formcomponents:any,formuiview:string) =>{
  const name=NEWFIELDS+id
  const components=formcomponents
  components[formuiview]=components[formuiview].filter((formcomponent:any)=>formcomponent.id!==id)
  const newviews=formuiSpec
  newviews['views'][formuiview]['fields']=newviews['views'][formuiview]['fields'].filter((field:any)=>field!==name)
  console.log(components)
  return {newviews,components}
}

const addfield = (props:any) =>{
  const {uuid,id,formuiSpec,formcomponents,formuiview}=props
  const name=NEWFIELDS+uuid
  const newfield=getcomponent(id,{'name':name,label:id})
  const newuiSpec=formuiSpec.fields;
  newuiSpec[name]=newfield
  const newviews=formuiSpec.views
  newviews[formuiview]['fields']=[...newviews[formuiview]['fields'],name]
  const fieldprops=convertuiSpecToProps(newfield)
  const newuiSpeclist=FieldSettings(newfield,name,fieldprops)
  const components=formcomponents
  components[formuiview]=[...components[formuiview],{id:uuid,uiSpec:newuiSpeclist,designvalue:'settings'}];
  return {newviews,components,newuiSpeclist,newuiSpec}
}

const updatefield = (props:any) =>{
  const {event,formuiSpec,formcomponents,formuiview}=props
  const fieldname=event.target.name
  const fieldvalue=event.target.value
  const updatedfield=getfieldname(fieldname,NEWFIELDS);
  const components=formcomponents
  const newviews=formuiSpec

  if (formuiSpec!==undefined && updatedfield.name!==''&& updatedfield.type!==''){
    const newfieldname=updatedfield.name
    const fieldtype=updatedfield.type
    const fieldprops=convertuiSpecToProps(formuiSpec['fields'][newfieldname])
    if(fieldtype==='required') fieldprops[fieldtype]=!fieldprops[fieldtype];
    else fieldprops[fieldtype]=fieldvalue

    const newfield=getcomponent(fieldprops['type'],fieldprops);
    const fields=changeuifield(newfieldname,newfield,formuiSpec['fields'])

    components[formuiview].map((item:any)=>{
            item.id===updatedfield.index?item['uiSpec']['fields']=changeuifield(newfieldname,newfield,item['uiSpec']['fields']):item
          }) 
    newviews['fields']=fields
  }
  return {newviews,components}

}

 const changeuifield = (newfieldname:string,newfield:any,uiSpec:any) =>{
      //update the formuiSpec
      const fields=uiSpec
      fields[newfieldname]=newfield
      return fields;
    }

const formvsectionadd = (props:any) =>{
  const {tabs,formuiSpec,formcomponents,formvariants}=props
  const index=tabs.length-1
  const newtabname=tabs[index]
  const newviews=formuiSpec
  const components=formcomponents
  const name=formvariants+newtabname

  console.log(formvariants)

  if(newviews['views'][name]===undefined){
    newviews['views'][name]={'fields':[],uidesign:'form',label:newtabname}
    newviews['viewsets'][formvariants]['views']=[...newviews['viewsets'][formvariants]['views'],name];
  }

  if(components[name]===undefined){
    components[name]=[]
  }
  return {newviews,components}
}

const formvariantsadd = (props:any) =>{
  const {tabs,formuiSpec,formcomponents,formuiview}=props
  const index=tabs.length-1
  const newtabname=tabs[index]
  const newviews=formuiSpec
  const components=formcomponents
  newviews[VISIBLE_TYPE]=[...newviews[VISIBLE_TYPE],newtabname]; //add new tab
  if(newviews['viewsets'][newtabname]===undefined){
    newviews['viewsets'][newtabname]={'views':[],label:newtabname}
  }
  return {newviews,components}

}

