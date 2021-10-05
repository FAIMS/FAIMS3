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
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform,handlertype,uiSpecType} from '../data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton,AddButton} from './ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../../sync/databases';


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
const variant_label=['main']

type ProjectDesignProps={ 
	project_id:string;
	formuiSpec:uiSpecType;
	setFormuiSpec:handlertype; 
	handleSaveUiSpec:handlertype;
	accessgroup:Array<string>;
}
type formcomponents=any

export default function ProjectDesignTab(props:ProjectDesignProps) {
    // if(props.project_id===undefined) console.log('New Project'+props.project_id)
    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const {project_id,formuiSpec,setFormuiSpec,accessgroup,...others}=props
    const [initialValues,setinitialValues]=useState(ini)
    const [formcomponents,setFormComponents]= useState<formcomponents>(form_defult)
    const [isAddField,setIsAddField]=useState(true)
    const [currentView,setCurrentView]=useState(sections_default[0])
    const [formlabel,setformlabel]=useState<string>(variant_label[0])
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
      const newformcom=updateuiSpec('newfromui',{formuiSpec:formui,formcomponents:formcomponents})


      const newformvariants=formui[VISIBLE_TYPE][0]
      setFormVariants(newformvariants)
      setformTabs(formui[VISIBLE_TYPE].map((tab:string)=>tab=formuiSpec['viewsets'][tab]['label']??tab))
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
      
      setformTabs(variant_label)
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
      const id=formuiSpec['viewsets'][formvariants]['views'][index]
      setCurrentView(sectiontabs[index])
      setformuiview(id)
      setfieldValue(0) //TODO: remove it
      

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
	        setfieldValue(1) //TODO: remove it
	        
	      }
    }

    const handelonChangeLabel = (tabs:Array<string>,type:string) =>{
      const {newviews,components}=updateuiSpec('formvariants'+type,{tabs:tabs,formuiSpec:formuiSpec,formcomponents:formcomponents})
      setFormuiSpec({fields:formuiSpec.fields,views:newviews.views,viewsets:newviews.viewsets,visible_types:newviews.visible_types})
      if(type==='add'){// To fix the misread of tab names
      	ChangeVariants(tabs[tabs.length-1])
      	setformlabel(formtabs[tabs.length-1])
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
      return true;
     }

     /****This function is to save data to DB TODO LIST*********/
    const saveorsync = () =>{
     }




    const handleChangeFormField = (event:any) =>{
      //could pass value to uiSpec: visible_type, access initialvalue
      //could pass value to project: setting info: name, description, access role, option or not
      //TEMPARY: just handle visible_type

      if(formuiSpec['visible_types'].length===1&&event.target.value===false) console.log('not change value')
      else{
        //update visible_type for uiSpec
      }
    }

    const submithandlerField = (values:any)=>{
      
    }

  return ( 

      <Grid container  >
      <AddButton id='SaveUiSpec'  onButtonClick={props.handleSaveUiSpec}  text='Click to Save Form Design' />
      <Grid item sm={12} xs={12}>
        <TabEditable tabs={formtabs} value={formtabs.indexOf(formlabel)>0?formtabs.indexOf(formlabel):0} handleChange={handelonChangeVariants}  tab_id='formtab' handelonChangeLabel={handelonChangeLabel} />
        <TabEditable tabs={sectiontabs} value={sectiontabs.indexOf(currentView)>0?sectiontabs.indexOf(currentView):0} handleChange={handelonChangeSection}  tab_id='sectiontab' handelonChangeLabel={handelonChangeLabelSection}/>
      </Grid>
      <Grid item sm={8} xs={12}>
      <Grid container  >
      <Grid item sm={2} xs={12} className={classes.settingtab}>  
      <TabTab tabs={['Component']} value={fieldvalue} handleChange={handleChangetabfield}  tab_id='fieldtab'/>
      </Grid>
      <Grid item sm={10} xs={12}>
      <TabPanel value={fieldvalue} index={1} tabname='fieldtab' >
       
      </TabPanel>
      <TabPanel value={fieldvalue} index={0} tabname='fieldtab' >
      
      {formuiview!==''&&formcomponents[formuiview].length>0?formcomponents[formuiview].map((formcomponent:any,index:any)=>(
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
        </Formik>)):''}
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
      </Grid>
      <Grid item sm={4} xs={12}>
        <FormConnectionCard tabs={formtabs} formuiSpec={formuiSpec} tabname={formlabel}/>
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

  );
}

