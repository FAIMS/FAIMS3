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
 * Filename: project-create.tsx
 * Description:
 *   TODO
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import {v4 as uuidv4} from 'uuid';
import grey from '@material-ui/core/colors/grey';

import {Button, Grid, Box, ButtonGroup, Typography,AppBar,Hidden} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import FieldsListCard from './tabs/FieldsListCard';
import {SettingCard} from './tabs/PSettingCard';
import {getComponentFromField} from './FormElement';
import {TabTab,TabEditable} from './tabs/TabTab'
import {FieldSettings,getcomponent,getfieldname,convertuiSpecToProps,setProjectInitialValues,getid,sampleuispec} from './data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton,AddButton} from './tabs/ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../sync/databases';
import {ProjectUIModel} from '../../../datamodel/ui'
import {create_new_project_dbs}  from '../../../sync/new-project'

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },
  newfield:{
    // backgroundColor:'#e1e4e8',
    // borderTop:'1px solid #e1e4e8',
  },
  newfield_button:{
    textAlign:'right',
  },
  addfield:{
    // border:'1px solid #e1e4e8',
    flexGrow: 1,
    padding: theme.spacing(2),
  }
}));



const NEWFIELDS='newfield'
const sections_default=['section2']
const variant_default=['main']
const projecttabs=['Design','Preview']
const form_defult={'mainsection2':[]}
const projectname='newnotebook123'
export default function CreateProjectCard(props:any) {
    // if(props.project_id===undefined) console.log('New Project'+props.project_id)
    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const [project_id,setProjectID]=useState('');
    const [projectvalue,setProjectValue]=useState(ini)
    const [initialValues,setinitialValues]=useState(ini)
    const [projectuiSpec,setProjectuiSpec] = useState<Array<any>>()
    const [formcomponents,setFormComponents]= useState<any>(form_defult)
    const [formuiSpec,setFormuiSpec]=useState<{fields:any,views:any,viewsets:any,visible_types:any}>({fields:{},views:{},viewsets:{},visible_types:[]})
    const [uiSpec,setUISpec]=useState<{fields:any,views:any,viewsets:any,visible_types:any}>(props.uiSpec)
    const [isAddField,setIsAddField]=useState(true)
    const [currentView,setCurrentView]=useState(sections_default[0])
    const [designvalue,setDesignvalue]=useState<any>('settings')
    // const [designvalues,setDesignvalues]=useState<any>([])
    const [settingvalue,setsettingvalue]=useState<any>({fields:{},views:{}})
    const [formView,setFormView]=useState('start-view')
    const [formvariants,setFormVariants]= useState<any>(variant_default[0])
    const [formuiview,setformuiview]=useState(formvariants+currentView)
    const [formtabs,setformTabs]=useState<Array<string>>([])
    const [sectiontabs,setsectiontabs]=useState<Array<string>>([])
    const [tablists,setTablist]=useState<Array<string>>([])
    const [projecttabvalue,setProjecttabvalue]=useState(0)
    const [error, setError] = useState(null as null | {});



    useEffect(() => {

     setinit();
     if(project_id===''||project_id===null){
        getnewdb();
     }

    }, []);

    useEffect(() => {
      if(uiSpec!==null) {

        generateunifromformui(uiSpec)
        setFormuiSpec(uiSpec);
        console.log(formcomponents)
      }
      console.log(uiSpec)

    }, [uiSpec]);

     useEffect(() => {
      saveformuiSpec()
      console.log(formuiSpec)
    }, [formuiSpec]);

     const generateunifromformui = (formui:any) =>{
      const newformcom=formcomponents
      const tabs=formtabs
      formui['visible_types'].map((variant:any,index:any)=>{
        tabs[index]=variant
        if(index===0)
        formui['viewsets'][variant]['views'].map((view:string)=>{
          newformcom[view]=[]
          
          formui['views'][view]['fields'].map((fieldname:string)=>{
            const field=formui['fields'][fieldname]
            const fieldprops=convertuiSpecToProps(field)
            const newuiSpeclist=FieldSettings(field,fieldname,fieldprops)
            newformcom[view]=[...newformcom[view],{id:fieldname.replace(NEWFIELDS,''),uiSpec:newuiSpeclist,designvalue:'settings'}];
          })
        })

      })
      console.log(formui)
      const newformvariants=formui['visible_types'][0]
      setFormVariants(newformvariants)
      setformTabs(tabs)
      console.log(formvariants)
      setsectiontabs(formui['viewsets'][newformvariants]['views'].map((tab:string)=>tab=tab.replace(newformvariants,'')))
      setFormComponents(newformcom)
      setFormuiSpec(formui)
      const tt:Array<any>=[]
      tabs.map((tab:any,index:any)=>tt[index]={label:tab,isedited:false})
      setTablist(tt)
      return true;
    }

    const setinit =()=>{
      if(props.project_id!==undefined){
        getUiSpecForProject(props.project_id).then(setUISpec, setError);
        console.log(formuiSpec)
      }

      // if(props.project_id===undefined){
      // generate empty form
      const view=formvariants+sections_default[0]
      setCurrentView(view);
      const formview=formuiSpec.views
      formview[view]={'fields':[],uidesign:'form'}
      setFormuiSpec({fields:formuiSpec.fields,views:formview,viewsets:{'main':{views:[view]}},visible_types:variant_default})

      setformTabs(variant_default)
      setsectiontabs(sections_default)

      setFormComponents((prevalue:any)=>{
        const newvalue=prevalue
        if(newvalue[view]===undefined) newvalue[view]=[]
        return newvalue;
      })
      // }else{
      //   generateunifromformui(formuiSpec)
      // }

    }

    

    const submithandler = (values:any) =>{

    }
    
    const changeuifield = (newfieldname:string,newfield:any,uiSpec:any) =>{
      //update the formuiSpec
      const fields=uiSpec
      fields[newfieldname]=newfield
      return fields;
    }

    const handleChangeForm = (event:any,type='change',value='') => {
      
      // setProjectValue()
      saveorsync()
      const updatedfield=getfieldname(event.target.name,NEWFIELDS);
      if (formuiSpec!==undefined && updatedfield.name!==''&& updatedfield.type!==''){
        const newfieldname=updatedfield.name
        const fieldtype=updatedfield.type
        const fieldprops=convertuiSpecToProps(formuiSpec['fields'][newfieldname])
        if(fieldtype==='required') fieldprops[fieldtype]=!fieldprops[fieldtype];
        else fieldprops[fieldtype]=event.target.value

        const newfield=getcomponent(fieldprops['type'],fieldprops);
        setFormuiSpec({...formuiSpec,fields:changeuifield(newfieldname,newfield,formuiSpec['fields'])})

        const formcomponet=formcomponents
        
        setFormComponents((prevalue:any)=>{
          const newvalue=prevalue
          newvalue[formuiview].map((item:any)=>{
            item.id===updatedfield.index?item['uiSpec']['fields']=changeuifield(newfieldname,newfield,item['uiSpec']['fields']):item
          })
          return newvalue;
        })
        

        
        
      }
      // return true;
     }

     /****This function is to save data to DB TODO LIST*********/
     const saveorsync = () =>{
     }

    const handleAddField = (id:any) =>{
      const uuid=getid()
      const name=NEWFIELDS+uuid
      const newfield=getcomponent(id,{'name':name,label:id})
      const newuiSpec=formuiSpec.fields;
      newuiSpec[name]=newfield
      const newviews=formuiSpec.views
      newviews[formuiview]['fields']=[...newviews[formuiview]['fields'],name]
      const fieldprops=convertuiSpecToProps(newfield)
      const newuiSpeclist=FieldSettings(newfield,name,fieldprops)


      setinitialValues({...initialValues,...setProjectInitialValues(newuiSpeclist,formView,{})})
      const newvalue=formcomponents
      newvalue[formuiview]=[...newvalue[formuiview],{id:uuid,uiSpec:newuiSpeclist,designvalue:'settings'}];
      setFormComponents(newvalue)

      setFormuiSpec({fields:newuiSpec,views:newviews,viewsets:formuiSpec.viewsets,visible_types:formuiSpec.visible_types})

      setIsAddField(false)

    }

    const handleRemoveField = (id:any)=>{

      
      
      const newviews=formuiSpec.views
      newviews[formuiview]['fields']=newviews[formuiview]['fields'].filter((field:any)=>field!==NEWFIELDS+id)
      setFormuiSpec({fields:formuiSpec.fields,views:newviews,viewsets:formuiSpec.viewsets,visible_types:formuiSpec.visible_types})
      const newcom=formcomponents
      newcom[formuiview].filter((formcomponent:any)=>formcomponent.id!==id)
      setFormComponents(newcom)
    }
    const handleAddFieldButton = ()=>{
      setIsAddField(true)
    }
    const handleCloseFieldButton = () =>{
      setIsAddField(false)

    }

    const swithField = (index:any,type:boolean) =>{
      const newviews=formuiSpec.views
      const fields=newviews[formuiview]['fields']
      const field=fields[index]
      const components=formcomponents
      const component=formcomponents[formuiview][index]
      fields.splice(index,1)
      components[formuiview].splice(index,1)
      if(type) index=index+1 //down
      else index=index-1 //up
      fields.splice(index,0,field)
      components[formuiview].splice(index,0,component)
      newviews[formuiview]['fields']=fields
      setFormuiSpec({fields:formuiSpec.fields,views:newviews,viewsets:formuiSpec.viewsets,visible_types:formuiSpec.visible_types})
      setFormComponents(components)
    }
    const handleUpFieldButton = (index:any) =>{
      swithField(index,false)
    }
    const handleDownFieldButton = (index:any) =>{
      
      swithField(index,true)
      
    }

    const handelonClickSetting = (index:any,key:any) =>{

      const formcomponent=formcomponents
        formcomponent[formuiview].map((item:any)=>{
          item.id===key?item['designvalue']=index:item
        }
        )
       
      setFormComponents(formcomponent)
      const value=settingvalue
      value[key]=index
      value['start']=index

      setDesignvalue(index)


    }

    const handelonChangeSection = (event:any,index:number) =>{
      const id=sectiontabs[index]
      setCurrentView(id)
      setformuiview(formvariants+id)
      const name=formvariants+id
      const newuiSpec=formuiSpec
      if(newuiSpec['views'][name]===undefined){
        newuiSpec['views'][name]={'fields':[],uidesign:'form'}
        newuiSpec['viewsets'][formvariants]['views']=[...newuiSpec['viewsets'][formvariants]['views'],name];
        setFormuiSpec(newuiSpec)
        setIsAddField(true)
      }

      const formview=formcomponents
      if(formview[name]===undefined){
        formview[name]=[]
        setFormComponents(formview)
      }

    }

    const handelonChangeVariants = (event:any,index:number)=>{
      const id=formtabs[index]
      setFormVariants(id)

      const newuiSpec=formuiSpec
      if(newuiSpec['viewsets'][id]===undefined){
        newuiSpec['viewsets'][id]={views:sections_default.map((section:string)=>section=id+section)}
        newuiSpec['viewsets'][id]['views'].map((section:string)=>newuiSpec['views'][section]={'fields':[],uidesign:'form'}
          )
        // newuiSpec['visible_types']=[...newuiSpec['visible_types'],id];
        setFormuiSpec(newuiSpec)
        setIsAddField(true)
      }
      setsectiontabs(formuiSpec['viewsets'][id]['views'].length>0?formuiSpec['viewsets'][id]['views'].map((tab:string)=>tab=tab.replace(id,'')):sections_default)
      const name=id+sectiontabs[0]
      setformuiview(name)
      setCurrentView(sectiontabs[0])

      const formview=formcomponents
      if(formview[name]===undefined){
        formview[name]=[]
        setFormComponents(formview)
      }

    }
    const handelonChangeLabel = (tabs:Array<string>,pretabs:Array<string>) =>{
      // update uiSpecific
      const newuiSpec=formuiSpec
      
      // console.log(pretabs)
      // tabs.map((tab:string,index:number)=>{
      //   console.log(newuiSpec['visible_types'][index])
      //   console.log(formuiSpec['visible_types'][index]+'updated'+tab)
      //   if(formuiSpec['visible_types'][index]===undefined) {
      //     newuiSpec['viewsets'][tab]={views:sections_default.map((section:string)=>section=tab+section)}
      //     newuiSpec['viewsets'][tab]['views'].map((section:string)=>newuiSpec['views'][section]={'fields':[],uidesign:'form'})
      //   }else{if(formuiSpec['visible_types'][index]!==tab){
      //     newuiSpec['viewsets'][tab]=formuiSpec['viewsets'][formtabs[index]]
      //     delete newuiSpec['viewsets'][formtabs[index]]
      //   }}
      // })
      newuiSpec['visible_types']=tabs
      setFormuiSpec(newuiSpec)
      setTablist(tabs)
      // console.log(formuiSpec)
    }

    const handelonChangeLabelSection = (tabs:Array<string>) =>{
     console.log('update section')
      // console.log(formuiSpec)
    }



    const handleChangetab = (event:any,index:number) =>{
      setProjecttabvalue(index)
      // console.log(index)
    }
    const getfieldsFromCom = (formcomponent:any,view:string,formProps:any) =>{
      const fields=formcomponent.uiSpec['views'][view]['fields'];
      if(fields.length>0) 
        return fields.map((field:any) => {return getComponentFromField(formcomponent.uiSpec,field, formProps,handleChangeForm);
                        })
      return '';
    }


    const saveformuiSpec = async  () =>{
      try{

        console.log(project_id)
        if(project_id===''||project_id===null){
          console.log('no DB')
          console.log(metadata_dbs)
        }else{
          console.log(await setUiSpecForProject(metadata_dbs[project_id].local, formuiSpec));
          
        }

      }catch (err) {
      console.error('databases needs cleaning...');
      console.debug(err);
      }
    }


    const getnewdb = async  () =>{
      try{
       const p_id=await create_new_project_dbs(projectname);
       if(p_id!==null) setProjectID(p_id);
      }catch (err) {
      console.error('databases not created...');
      console.log(err);
      }
    }

  return ( 
    <div className={classes.root}> 
     <Grid container  >
      <Grid item sm={12} xs={12}>
        <AppBar position="static" color='primary'>
          <TabTab tabs={projecttabs} value={projecttabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
        </AppBar>
      </Grid>
      <Grid item sm={12} xs={12}>
        <TabEditable tabs={formtabs} value={formtabs.indexOf(formvariants)} handleChange={handelonChangeVariants}  tab_id='subtab' handelonChangeLabel={handelonChangeLabel} />
        <TabEditable tabs={sectiontabs} value={sectiontabs.indexOf(currentView)>0?sectiontabs.indexOf(currentView):0} handleChange={handelonChangeSection}  tab_id='subtab' handelonChangeLabel={handelonChangeLabelSection}/>
      </Grid>
      <Grid item sm={8} xs={12}>  
        <Formik
          initialValues={initialValues}
          validateOnMount={true}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              submithandler(values)
            }, 500);}}
        >

        {formProps => {
              return (
                <Form >
                {formcomponents[formuiview].length>0?formcomponents[formuiview].map((formcomponent:any,index:any)=>(
                <Grid container className={classes.newfield} key={`formcompoenet-form-${index}`}>
                <Grid item sm={10} xs={12}>
                  <Grid container spacing={1} >
                    <Grid item sm={4} xs={12} >
                      {getfieldsFromCom(formcomponent,'general',formProps)}
                    </Grid>
                    <Grid item sm={1} xs={3} >          
                      <SettingCard handelonClick={handelonClickSetting} key_id={formcomponent.id}/>  
                    </Grid>
                    <Grid item sm={7} xs={9}>
                      {getfieldsFromCom(formcomponent,formcomponent.designvalue,formProps)}
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item sm={2} xs={12} className={classes.newfield_button}>
                  {index>0?<UpButton  onButtonClick={handleUpFieldButton} value={index} id={index} text='X' />:''}
                  {index<formcomponents[formuiview].length-1?<DownButton  onButtonClick={handleDownFieldButton} value={index} id={index} text='X' />:''}
                  <CloseButton  onButtonClick={handleRemoveField} value={formcomponent.id} id={formcomponent.id} text='X' />
                </Grid>
                </Grid>
                )):''}
                </Form>
              );
        }}
        </Formik>
        <AddButton  onButtonClick={handleAddFieldButton}  text='ADD' />
        {isAddField?
        <Grid container className={classes.addfield} >
          <Grid item sm={11} xs={11}>
          <FieldsListCard cretenefield={handleAddField} />
          </Grid>
          <Grid item sm={1} xs={1} className={classes.newfield_button}>  
            <CloseButton  onButtonClick={handleCloseFieldButton} text='X' />
          </Grid>
        </Grid>
        :''}
      </Grid>
      <Grid item sm={4} xs={12}>
        <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(formuiSpec, null, 2)}</pre>
        </Box>
      </Grid>
    </Grid>
  </div>

  );
}

