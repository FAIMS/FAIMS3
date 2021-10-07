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
import {getcomponent,convertuiSpecToProps} from './uiFieldsRegistry'
import {getComponentPropertiesByName} from '../../../component_registry';
import {FAIMSUiSpec} from '../../../../datamodel/ui';

const VISIBLE_TYPE='visible_types'
const NEWFIELDS='newfield'
const DEFAULT_accessgroup=['admin','moderator']
const DEFAULT_accessgroup_d=['admin','moderator','team']
export type handlertype=any
export type uiSpecType={fields:any,views:any,viewsets:any,visible_types:any}
export type projectvalueType=any
type signlefieldType=any
type fieldlistType=any
type viewlistType=any
export const getid = ()=>{
	return uuidv4().split('-')[0];
}

export const getconnections = (comparetab:string, uiSpec:uiSpecType,origintab:string) =>{
  const conection='TO be added';
  return conection;
}

export const getfieldname = (name:string,label:string) =>{
	const names=name.split(label);
	if(names.length>1)
		return {'type':names[0],'name':label+names[1],'index':names[1]};
	return {'type':'','name':'',index:0};
}

const getsettingform = (component:any) =>{
    if(component['component-name']==='Select')  return [{name:'options',lable:'options',type:'TextField',view:'settings',multiline:true,multirows:4,initialValue:'Default',helperText:'Type options here, speprate by Space(will edit)'}]
    try{
      const props=getComponentPropertiesByName(component['component-namespace'],component['component-name'])
      const settingsarray:Array<FAIMSUiSpec>=[]
      props['settingsProps'].map( (setting:FAIMSUiSpec) =>
        setting['settings']===undefined?settingsarray.push({...setting,view:'settings'}):setting)
      return settingsarray;
    }catch(err: any) {
      console.error('setUISpec/setLastRev error', err);

    }
    
    return []
}
//Add new field form or convert uiSpec to setting form convertuiSpectoSetting
export const FieldSettings=(component:signlefieldType,label:string,props:any,access:Array<string>=DEFAULT_accessgroup_d)=>{
  const options:Array<{value:string;label:string}>=[];
  const limitaccess=access.filter((access:string)=>!(access==='admin'||access==='moderator'))
  limitaccess.map((option:string,index:number)=>options[index]={
                value: option,
                label: option
              })
  console.log(options)
	const fields=[
        {name:'',lable:'',type:'TextField',view:'general'},
        {name:'label',lable:'Label',namespace:'formik-material-ui',componentName:'TextField',view:'settings'},
        {name:'helperText',lable:'Hit Text for Complete Form',namespace:'formik-material-ui',componentName:'TextField',view:'settings'},
        {name:'required',lable:'Check if is compusory',namespace:'faims-custom',componentName:'Checkbox',view:'valid'},
        {name:'validationSchema',lable:'validationSchema',namespace:'formik-material-ui',componentName:'TextField',view:'valid',multiline:true,multirows:4,disabled:true,helperText:'Now disbaled, Will be enabled after validation been added.'},
        {name:'access',lable:'access',namespace:'faims-custom',componentName:'Select',select: true,type:'select',view:'access',options:options,helperText:'It will be replace to the new field, original access:'+props.access.toString()},//TODO: working on newfield
        {name:'annotation_label',lable:'annotation Label',namespace:'formik-material-ui',componentName:'TextField',view:'notes'},
        {name:'meta_type',lable:'Include Uncertainty',namespace:'faims-custom',componentName:'Checkbox',view:'notes',initialValue:true},
        {name:'meta_type_label',lable:'Uncertainty Label',namespace:'formik-material-ui',componentName:'TextField',view:'notes'},
        ]
  const settingsform=getsettingform(component)
  const length=fields.length;
  if(settingsform.length>0){
    settingsform.map((field:signlefieldType,index:number)=>fields[length+index]=field
    )
  }
  
	const fields_label:Array<string>=[]
	const fields_list:fieldlistType={}
	const view_list=['settings','valid','access','notes','general']
	const views:viewlistType={'start-view':{fields:[],uidesign:'settings'}}
	view_list.map(view=>views[view]={fields:[],uidesign:'settings'})
	fields.map((field,index)=>{
		const fieldname=field.name+`${label}`
		fields_label[index]=fieldname
		if(index===0) { 
			fields_list[fieldname]=component;
		}else {//field.type,
      const {lable,name,namespace,componentName,view,...others}=field
			fields_list[fieldname]=getcomponent({'name':fieldname,label:lable,initialValue:props[name],namespace:namespace,componentName:componentName,placeholder:props[name]!==undefined?props[name].toString():name,...others});
		}
		const view=field.view
    if(!(component['component-name']==='TemplatedStringField'&&field.name==='required'))
			views[view]['fields']=[...views[view]['fields'],fieldname]
			views[view]['uidesign']='settings'
		
	})
	views['start-view']={'fields':fields_label,'uidesign':'settings'}
  console.log(fields_list)

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
  //'TextField',
	tabs.map((tab:string,index:number)=> {fields_list['formelement'+index]=getcomponent({name:'formelement'+index, lable:tab, initialValue:tab, placeholder:tab}); fields[index]='formelement'+index
		});

	return {
		fields:fields_list,
    'views':{'start-view':{fields:fields}} ,
    'start_view': 'start-view'
	}
}

type projectuilistType=any
export const getprojectform= (projectvalue:projectvalueType,tab:string,props:any=null) =>{ //this function is just template to get information about the project
  const fields_list:any={}
  const fieldsarray:Array<string>=[]
  const section_info=[
  {name:'sectionname',label:'Section Name',namespace:'formik-material-ui',componentName:'TextField',view:'section',required:true},
  {name:'sectiondescription',label:'Description',namespace:'formik-material-ui',componentName:'TextField',view:'section',multiline:true,multirows:4},
  {name:'sectiondeaccess',label:'Access',namespace:'formik-material-ui',componentName:'TextField',view:'section',multiline:true,multirows:4,initialValue:projectvalue.accesses},
  ]

  const fields:projectuilistType={info_general:[
  {name:'name',label:'Project Name',namespace:'formik-material-ui',componentName:'TextField',view:'info_general',required:true},
  {name:'description',label:'Description',namespace:'formik-material-ui',componentName:'TextField',view:'info_general',multiline:true,multirows:4},
  {name:'project_lead',label:'Lead',namespace:'formik-material-ui',componentName:'TextField',view:'info_general'},
  {name:'lead_institution',label:'lead_institution',namespace:'formik-material-ui',componentName:'TextField',view:'info_general'}],
  info_group:[
  {name:'accessadded',label:'Add User Roles',namespace:'formik-material-ui',componentName:'TextField',view:'info_group',required:false,value:projectvalue['accessadded']}],
  section:[],
  }  

  // This part will be updated in the future TODO
  if(projectvalue.project_id!==undefined){
    fields['info_general'][0].disabled=true;
    fields['info_general'][1].disabled=true;
  }
  if(tab==='section'){
    section_info.map((section:any,index:number)=>fields[tab][index]={...section,name:section.name+props.sectionname}
      )
    
  }
  console.log(fields)
  fields[tab].map((field:any,index:number)=> {
     const {name,view,initialValue,...others}=field
    fields_list[field.name]=getcomponent({name:name,initialValue:initialValue??projectvalue[name], placeholder:projectvalue[name],...others}); 
    fieldsarray[index]=field.name
    });
  return {
    fields:fields_list,
    'views':{'start-view':{fields:fieldsarray,'uidesign':'general'}} ,
    'start_view': 'start-view',
     viewsets:{},
     visible_types:[]
  }
}

export const setProjectInitialValues = (uiSpec:uiSpecType,currentView:string,initialValues: any) => {
    const existingData: {
      [viewName: string]: {[fieldName: string]: unknown};
    } = {};
    const fields = uiSpec['fields'];
    const fieldNames = uiSpec['views'][currentView]['fields'];
    fieldNames.forEach((fieldName:string) => {
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
      return newfromui(props.formuiSpec,props.formcomponents,props.access);
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

const newfromui = (newuiSpec:uiSpecType,newformcom:any,access:Array<string>) =>{
  newuiSpec[VISIBLE_TYPE].map((variant:any,index:any)=>{
       
        newuiSpec['viewsets'][variant]['views'].map((view:string)=>{
          newformcom[view]=[]    
          newuiSpec['views'][view]['fields'].map((fieldname:string)=>{
            const field=newuiSpec['fields'][fieldname]
            const fieldprops=convertuiSpecToProps(field)
            const newuiSpeclist=FieldSettings(field,fieldname,fieldprops,access)
            newformcom[view]=[...newformcom[view],{id:fieldname.replace(NEWFIELDS,''),uiSpec:newuiSpeclist,designvalue:'settings'}];
          })
        })
      })
  return newformcom;
}

 const swithField = (index:any,type:boolean,formuiSpec:uiSpecType,formcomponents:any,formuiview:string) =>{
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
const removefield = (id:string,formuiSpec:uiSpecType,formcomponents:any,formuiview:string) =>{
  const name=NEWFIELDS+id
  const components=formcomponents
  components[formuiview]=components[formuiview].filter((formcomponent:any)=>formcomponent.id!==id)
  const newviews=formuiSpec
  newviews['views'][formuiview]['fields']=newviews['views'][formuiview]['fields'].filter((field:any)=>field!==name)
  return {newviews,components}
}

const addfield = (props:any) =>{
  const {uuid,id,formuiSpec,formcomponents,formuiview,accessgroup}=props
  const name=NEWFIELDS+uuid
  const newfield=getcomponent({'name':name,label:id.componentName,access:accessgroup,...id})
  const newuiSpec=formuiSpec.fields;
  newuiSpec[name]=newfield
  const newviews=formuiSpec.views
  const fieldprops=convertuiSpecToProps(newfield)
  const newuiSpeclist=FieldSettings(newfield,name,fieldprops,accessgroup)
  const components=formcomponents
  newviews[formuiview]['fields']=[...newviews[formuiview]['fields'],name]
  components[formuiview]=[...components[formuiview],{id:uuid,uiSpec:newuiSpeclist,designvalue:'settings'}];
  return {newviews,components,newuiSpeclist,newuiSpec}
}

const updatefield = (props:any) =>{
  const {event,formuiSpec,formcomponents,formuiview,access}=props
  const fieldname=event.target.name
  const fieldvalue=event.target.value
  const updatedfield=getfieldname(fieldname,NEWFIELDS);
  const components=formcomponents
  const newviews=formuiSpec
  if (formuiSpec!==undefined && updatedfield.name!==''&& updatedfield.type!==''){
    const newfieldname=updatedfield.name
    const fieldtype=updatedfield.type
    if(fieldtype==='validationSchema') return {newviews,components}
    const fieldprops=convertuiSpecToProps(formuiSpec['fields'][newfieldname])
    console.log(fieldprops['access'])
    if(fieldtype==='required'||fieldtype==='meta_type') fieldprops[fieldtype]=!fieldprops[fieldtype];
    else fieldprops[fieldtype]=fieldvalue
    if(fieldtype==='options') {
      fieldprops[fieldtype]=[];
      const options=fieldvalue.split(' ');
      options.map((option:string,index:number)=>fieldprops[fieldtype][index]={
                value: option,
                label: option
              });
    }
    if(fieldtype==='access') {
      console.log(fieldprops[fieldtype])
      if(typeof fieldprops[fieldtype]==='string') fieldprops[fieldtype]=[fieldprops[fieldtype]]
      DEFAULT_accessgroup.map((accessrole:string)=>fieldprops[fieldtype].includes(accessrole)?accessrole:fieldprops[fieldtype]=[...fieldprops[fieldtype],accessrole])
      console.log(fieldprops[fieldtype])
    }
    if(fieldtype==='validationSchema') {
      fieldprops[fieldtype]=[];
      const validationSchemas=fieldvalue.split(',');
      validationSchemas.map((validationSchema:string,index:number)=>fieldprops[fieldtype][index]=[validationSchema]); // this function need to be updated
    }
    const newfield=getcomponent(fieldprops);//fieldprops['type']??fieldprops['component-name'],
    const fields=changeuifield(newfieldname,newfield,formuiSpec['fields'])

    components[formuiview].map((item:any)=>{
            item.id===updatedfield.index?item['uiSpec']['fields']=changeuifield(newfieldname,newfield,item['uiSpec']['fields']):item
          }) 
    // newviews['fields']=fields
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

