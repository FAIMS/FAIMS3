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
 * Filename: ProjectDesign.tsx
 * Description:This is the file about form design, all uiSpec related sould be defined here
 *   TODO: [BUG] when form tab changes, section tab should be reset(Should use tabPanels instead??)
 *   TODO: [BUG] edit Project is not working, can't read information for project
 *   TODO: swith the form component, need to change to drag element
 *   TODO: [BUG] Validationschma 
 *   TODO: [BUG] uiSpec ini setup issue for creating new notebook, and formcomponent issue for edit existing project
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Button, Grid, Box, ButtonGroup, Typography,AppBar,Hidden,Paper} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import FieldsListCard from './FieldsListCard';
import {SettingCard,FormConnectionCard} from './PSettingCard';
import {getComponentFromField,FormForm} from '../FormElement';
import {TabTab,TabEditable} from './TabTab';
import TabPanel from './TabPanel';
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform,handlertype,uiSpecType,projectvalueType} from '../data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton,AddButton} from './ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../../sync/databases';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';


const useStyles = makeStyles((theme) => ({
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
    padding: theme.spacing(1),
  },
  settingtab:{
    backgroundColor:'#e1e4e8',
  }
}));



const NEWFIELDS='newfield'
const sections_default=['SECTION1']
const variant_default=['FORM1']
const form_defult={'FORM1SECTION1':[]}
const VISIBLE_TYPE='visible_types'
const variant_label='main'

type ProjectDesignProps={ 
  project_id:string;
  formuiSpec:uiSpecType;
  setFormuiSpec:handlertype; 
  handleSaveUiSpec:handlertype;
  accessgroup:Array<string>;
  projectvalue:projectvalueType;
  setProjectValue:handlertype; 
}
type formcomponents=any

export default function ProjectDesignTab(props:ProjectDesignProps) {
    // if(props.project_id===undefined) console.log('New Project'+props.project_id)
    
    const theme = useTheme();
    const classes = useStyles(theme);
    const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
    const {project_id,formuiSpec,setFormuiSpec,accessgroup,...others}=props
    const ini={_id:project_id??'new_notbook'}
    const [initialValues,setinitialValues]=useState(ini)
    const [formcomponents,setFormComponents]= useState<formcomponents>(form_defult)
    const [isAddField,setIsAddField]=useState(true)
    const [currentView,setCurrentView]=useState(sections_default[0])
    const [formlabel,setformlabel]=useState<string>(variant_label)
    const [designvalue,setDesignvalue]=useState<string>('settings')
    const [settingvalue,setsettingvalue]=useState<{fields:{},views:{}}>({fields:{},views:{}})
    const [formView,setFormView]=useState('start-view')
    const [formvariants,setFormVariants]= useState<string>(variant_default[0])
    const [formuiview,setformuiview]=useState(formvariants+currentView)
    const [formtabs,setformTabs]=useState<Array<string>>([])
    const [sectiontabs,setsectiontabs]=useState<Array<string>>([])
    
    const [projecttabvalue,setProjecttabvalue]=useState(0)
    const [error, setError] = useState(null as null | {});
    const [fieldvalue,setfieldValue] = useState(0); //field tab 
    const [formsectionvalue,setformsectionvalue]=useState(0)



    useEffect(() => {

     setinit();

    }, []);

    useEffect(() => {
      //this function should be used to get new project ui when project_id changes??
      
      setinit();
    }, [project_id]);

    

     const generateunifromformui = (formui:uiSpecType) =>{
      const tabs:Array<string>=[];
      formui[VISIBLE_TYPE].map((tab:string)=>tabs.push(formuiSpec['viewsets'][tab]['label']??tab))
      const newformcom=updateuiSpec('newfromui',{formuiSpec:formui,formcomponents:formcomponents,access:accessgroup})

      const newformvariants=formui[VISIBLE_TYPE][0]

      setFormVariants(newformvariants)
      setformTabs(formui[VISIBLE_TYPE].map((tab:string)=>tab=formuiSpec['viewsets'][tab]['label']??tab))
      let newini=initialValues
      for (const [key,value] of Object.entries(newformcom)) {
        newformcom[key].map((fieldlist:any)=>
          newini={...ini,...setProjectInitialValues(fieldlist['uiSpec'],formView,{})}
          )
      }
      setinitialValues({...initialValues,...newini})
      // const stabs:Array<string>=[]
      // formui['viewsets'][newformvariants]['views'].map((tab:string)=>tabs.push(formuiSpec['views'][tab]['label']))
      setsectiontabs(formui['viewsets'][newformvariants]['views'].map((tab:string)=>tab=formuiSpec['views'][tab]['label']??tab))
      setFormComponents(newformcom)
      setFormuiSpec(formui)
      setformlabel(formtabs[0])

      return true;
    }

    const setinit =()=>{
      

      // if(props.project_id===undefined){
      // generate empty form
      const view=formvariants+sections_default[0]
      setCurrentView(view);
      
      setformTabs([variant_label])
      setsectiontabs(sections_default)

      setFormComponents((prevalue:formcomponents)=>{
        const newvalue=prevalue
        if(newvalue[view]===undefined) newvalue[view]=[]
        return newvalue;
      })
      // console.log(formuiSpec)
      if(formuiSpec!==null){

        generateunifromformui(formuiSpec)
      }
        

    }

    const handleAddField = (id:string) =>{
      const uuid=getid()

      const {newviews,components,newuiSpeclist,newuiSpec}=updateuiSpec('addfield',{uuid:uuid,id:id,formuiSpec:formuiSpec,formcomponents:formcomponents,formuiview:formuiview,accessgroup:accessgroup})
      setinitialValues({...initialValues,...setProjectInitialValues(newuiSpeclist,formView,{_id:project_id})})
      setFormComponents(components)
      setFormuiSpec({fields:newuiSpec,views:newviews,viewsets:formuiSpec.viewsets,visible_types:formuiSpec.visible_types})
      setIsAddField(false)
      

    }

    const handleRemoveField = (index:string)=>{
      const {newviews,components}=updateuiSpec('removefield',{index:index,formuiSpec:formuiSpec,formcomponents:formcomponents,formuiview:formuiview})
      setFormComponents(components)
      setFormuiSpec({...formuiSpec,views:newviews.views})

    }
    const handleAddFieldButton = ()=>{
      setIsAddField(true)
    }
    const handleCloseFieldButton = () =>{
      setIsAddField(false)

    }


    const handleUpFieldButton = (index:number) =>{
      const {newviews,components}=updateuiSpec('switch',{index:index,type:false,formuiSpec:formuiSpec,formcomponents:formcomponents,formuiview:formuiview})
      setFormuiSpec({...formuiSpec,views:newviews.views})
      setFormComponents(components)
    }
    const handleDownFieldButton = (index:number) =>{
      
      const {newviews,components}=updateuiSpec('switch',{index:index,type:true,formuiSpec:formuiSpec,formcomponents:formcomponents,formuiview:formuiview})
      setFormuiSpec({...formuiSpec,views:newviews.views})
      setFormComponents(components)
      
    }

    const handelonClickSetting = (index:string,key:string) =>{

      const formcomponent=formcomponents
        formcomponent[formuiview].map((item:any)=>{
          item.id===key?item['designvalue']=index:item
        }
        )
       
      setFormComponents(formcomponent)
      setDesignvalue(index)


    }

    const handelonChangeSection = (event:any,index:number) =>{
      console.log(index)
      const id=formuiSpec['viewsets'][formvariants]['views'][index-1]
      console.log(id)
      setCurrentView(sectiontabs[index-1])
      setformuiview(id)
      setfieldValue(0) //TODO: remove it
      setformsectionvalue(index)
      

    }

    const handelonChangeVariants = (event:any,index:number)=>{
        const id=formuiSpec[VISIBLE_TYPE][index]
        ChangeVariants(id)
        setformlabel(formtabs[index])
    }

    const ChangeVariants = (id:string) =>{
        setFormVariants(id)
        
        
        if(formuiSpec['viewsets'][id]['views'].length>0){
          console.log(formuiSpec['viewsets'][id]['views'][0])
          const tabs:any=[]
          if(formuiSpec['viewsets'][id]['views'].length>0){
            formuiSpec['viewsets'][id]['views'].map((tab:string,number:number)=>tabs[number]=formuiSpec['views'][tab]['label'])
          }
          setsectiontabs(tabs)
          setformuiview(formuiSpec['viewsets'][id]['views'][0])
          setCurrentView(formuiSpec['viewsets'][id]['views'][0]) // this part seems not working, check it to fix the issue
          setfieldValue(0) //TODO: remove it
        }
        else{
          setsectiontabs([]);
          setformuiview('')
          setCurrentView('')
          setfieldValue(3) //TODO: remove it
          
        }
    }

    const handelonChangeLabel = (tabs:Array<string>,type:string) =>{
      const {newviews,components}=updateuiSpec('formvariants'+type,{tabs:tabs,formuiSpec:formuiSpec,formcomponents:formcomponents})
      setFormuiSpec({fields:formuiSpec.fields,views:newviews.views,viewsets:newviews.viewsets,visible_types:newviews.visible_types})
      if(type==='add'){// To fix the misread of tab names
        const tabname=tabs[tabs.length-1]
        ChangeVariants(tabname)
        setformlabel(formtabs[tabs.length-1])
        //set default value as preselect value for formaction
        const newprojectvalue=props.projectvalue
        newprojectvalue['submitAction'+tabname]="Save and New"
        props.setProjectValue({...newprojectvalue});
      }else{
        //after tabname changes direct user to form1 section1
        const tabname=formuiSpec['visible_types'][0]
        ChangeVariants(tabname)
        setformlabel(formtabs[0])
      }
    }

    const handelonChangeLabelSection = (tabs:Array<string>,type:string) =>{
     const {newviews,components}=updateuiSpec('formvsection'+type,{tabs:tabs,formuiSpec:formuiSpec,formcomponents:formcomponents,formvariants:formvariants})
      setFormuiSpec({fields:formuiSpec.fields,views:newviews.views,viewsets:newviews.viewsets,visible_types:newviews.visible_types})
      setFormComponents(components)
      if(type==='add'){ // To fix the misread of tab names
        setCurrentView(sectiontabs[sectiontabs.length-1])
        setformuiview(formuiSpec['viewsets'][formvariants]['views'][sectiontabs.length-1])
      }
      setfieldValue(0) //TODO: remove it
    }




    const handleChangetabfield = (event:any,index:number) =>{
      setfieldValue(index)
      
    }
    const getfieldsFromCom = (formcomponent:formcomponents,view:string,formProps:any) =>{
      const fields=formcomponent.uiSpec['views'][view]['fields'];
      if(fields.length>0) 
        return fields.map((field:any) => {return getComponentFromField(formcomponent.uiSpec,field, formProps,handleChangeForm);
                        })
      return '';
    }


    



    const submithandler = (values:any) =>{

    }
    
   

    const handleChangeForm = (event:any,type='change',value='') => {
      const {newviews,components}=updateuiSpec('updatefield',{event:event,formuiSpec:formuiSpec,formcomponents:formcomponents,formuiview:formuiview})
      setFormuiSpec({...formuiSpec,fields:newviews.fields})
      setFormComponents(components)
      console.log(event.target.name)
      console.log(initialValues)
      return true;
     }

     /****This function is to save data to DB TODO LIST*********/
    const saveorsync = () =>{
     }





    const handleChangeFormSection = (event:any) =>{
      const newprojectvalue=props.projectvalue
      if(newprojectvalue['sections']===undefined) newprojectvalue['sections']={}
      if(newprojectvalue['sections'][formuiview]===undefined) newprojectvalue['sections'][formuiview]={}
      newprojectvalue['sections'][formuiview][event.target.name]=event.target.value
      props.setProjectValue({...props.projectvalue,sections:newprojectvalue.sections})
    }

    const handleSubmitFormSection = (values:any) =>{
      const newprojectvalue=props.projectvalue
      if(newprojectvalue['sections']===undefined) newprojectvalue['sections']={}
      newprojectvalue['sections'][formuiview]=values
      props.setProjectValue({...props.projectvalue,sections:newprojectvalue.sections})
    }

    const handleChangeFormAction = (event:any) =>{
      const newproject=props.projectvalue
      newproject[event.target.name]=event.target.value
      props.setProjectValue(newproject)

      if(event.target.name==='submitAction'+formvariants){
        //update uiSpecf
        const newviews=formuiSpec
        newviews['viewsets'][formvariants]['action']=event.target.value
        setFormuiSpec({...formuiSpec,viewsets:newviews.viewsets})
      }

    }

    const handleSubmitFormAction = () =>{

    }


    const compnentPanel = () => {
      return (formcomponents[formuiview].map((formcomponent:any,index:any)=>(
        <Formik
        key={index}
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
                
                <Grid container className={classes.newfield} key={`formcompoenet-form-${index}`}>
                <Grid item sm={10} xs={12}>
                  <Grid container spacing={1} >
                    <Grid item sm={4} xs={12} >
                      {getfieldsFromCom(formcomponent,'general',formProps)}
                    </Grid>
                    <Grid item sm={1} xs={3} className={classes.settingtab}>          
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
                
                </Form>
              );
        }}
        </Formik>))
      );
    }

  const FieldPanel = () =>{
    /****section tab: 
     * SectionInfotTab
     * component Tab
    ***/
    return fieldvalue!==3?(
      <Grid container  >
      <Grid item sm={2} xs={12} className={classes.settingtab}>  
      <TabTab tabs={['Info','Component']} value={fieldvalue} handleChange={handleChangetabfield}  tab_id='fieldtab'/>
      </Grid>
      <Grid item sm={10} xs={12}>
      <TabPanel value={fieldvalue} index={3} tabname='fieldtab' >
      ''
      </TabPanel>
      <TabPanel value={fieldvalue} index={0} tabname='fieldtab' >
       <FormForm currentView='start-view' handleChangeForm={handleChangeFormSection} handleSubmit={handleSubmitFormSection} uiSpec={getprojectform(props.projectvalue,'section',{sectionname:formuiview})} />
      </TabPanel>
      <TabPanel value={fieldvalue} index={1} tabname='fieldtab' >
      {fieldvalue===1&&formuiview!==''&&formcomponents[formuiview].length>0?compnentPanel():''}
        <AddButton id='AddField'  onButtonClick={handleAddFieldButton}  text='ADD' />
        {isAddField?
        <Paper >
        <Grid container className={classes.addfield} >
          <Grid item sm={11} xs={11}>
          <FieldsListCard cretenefield={handleAddField} />
          </Grid>
          <Grid item sm={1} xs={1} className={classes.newfield_button}>  
            <CloseButton id='ColseAddField'  onButtonClick={handleCloseFieldButton} text='X' />
          </Grid>
        </Grid>
        </Paper>
        :''}
        </TabPanel></Grid></Grid>
      ):(<p>Next </p>);
  }
  const SectionPanel = () =>{
    return (
      <>
      {props.projectvalue!==undefined&&<FormForm currentView='start-view' handleChangeForm={handleChangeFormAction} handleSubmit={handleSubmitFormAction} uiSpec={getprojectform(props.projectvalue,'form',{formname:formvariants})} />}
      <TabEditable tabs={sectiontabs} value={formsectionvalue} handleChange={handelonChangeSection}  tab_id='sectiontab' handelonChangeLabel={handelonChangeLabelSection} />
      {sectiontabs.map((sectiontab:string,index:number)=>
        <TabPanel value={formsectionvalue} index={index} tabname='sectiontab' key={'sectiontab'+index}> 
          {FieldPanel()}
        </TabPanel>
      )}
      </>
      );
  }

// 

  const FormPanel = () =>{
    const value=formtabs.indexOf(formlabel)>0?formtabs.indexOf(formlabel):0
    return (
      <Grid container  >
        <Grid item sm={12} xs={12}>
        <TabEditable tabs={formtabs} value={formtabs.indexOf(formlabel)>0?formtabs.indexOf(formlabel):0} handleChange={handelonChangeVariants}  tab_id='formtab' handelonChangeLabel={handelonChangeLabel} />
        </Grid>
        <Grid item sm={not_xs?8:12} xs={12}>
        
      {formtabs.map((formtab:string,index:number)=>
        
        <TabPanel value={value} index={index} tabname='formtab' key={'formtab'+index}>
          {SectionPanel()}
        </TabPanel>
        )}
        </Grid>
        {not_xs?
        (<Grid item sm={4} xs={12}>
        
        <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
            {formtabs.length>1&&<FormConnectionCard tabs={formtabs} formuiSpec={formuiSpec} tabname={formlabel??'form'}/>}
            <pre>{JSON.stringify(props.projectvalue, null, 2)}</pre>
            <pre>{JSON.stringify(formuiSpec, null, 2)}</pre>
        </Box>
        </Grid>):('')}
      </Grid>)
  }

  return (
    <>
      {project_id!==''&&project_id!==null&&project_id!==undefined?
      (<AddButton id='SaveUiSpec'  onButtonClick={props.handleSaveUiSpec}  text='Click to Save Form Design' />):('')}
      {FormPanel()}
    </>

  );
}

