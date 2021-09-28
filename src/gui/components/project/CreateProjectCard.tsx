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
 * Filename: CreateProjectCard.tsx
 * Description:
 *   TODO: seperate the tabs to different files
 *   TODO: edit Project is not working, can't read information for project
 *   TODO: setup project information 
 *     TODO: Info, design, preview, User, Behaviour, submit
 *   TODO: swith the form component, need to change to drag element
 *   TODO: sync into and save to DB(??)
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
import {getComponentFromField,FormForm} from './FormElement';
import {TabTab,TabEditable} from './tabs/TabTab';
import TabPanel from './tabs/TabPanel';
import ProjectDesignTab from './tabs/ProjectDesign';
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform} from './data/ComponentSetting'
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
  },
  settingtab:{
    backgroundColor:'#e1e4e8',
  }
}));



const NEWFIELDS='newfield'
const sections_default=['SECTION1']
const variant_default=['FORM1']
const projecttabs=['Info','Design','Preview']
const form_defult={'FORM1SECTION1':[]}
const projectname='newnotebook123'
const VISIBLE_TYPE='visible_types'
const variant_label=['main']
export default function CreateProjectCard(props:any) {
    // if(props.project_id===undefined) console.log('New Project'+props.project_id)
    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const [project_id,setProjectID]=useState('');
    const [projectvalue,setProjectValue]=useState<any>({})
    const [initialValues,setinitialValues]=useState(ini)
    const [projectuiSpec,setProjectuiSpec] = useState<Array<any>>()
    const [projecttabvalue,setProjecttabvalue]=useState(0)
    const [formcomponents,setFormComponents]= useState<any>(form_defult)
    const [formuiSpec,setFormuiSpec]=useState<{fields:any,views:any,viewsets:any,visible_types:any}>({fields:{},views:{},viewsets:{},visible_types:[]})
    const [uiSpec,setUISpec]=useState<{fields:any,views:any,viewsets:any,visible_types:any}>(props.uiSpec)
    const [formtabs,setformTabs]=useState<Array<string>>([])    
    const [error, setError] = useState(null as null | {});



    useEffect(() => {

     setinit();

    }, []);

    // useEffect(() => {
    //   if(uiSpec!==null) {

        
    //     setFormuiSpec(uiSpec);
    //     console.log(formcomponents)
    //   }
    //   console.log('Update Changes')
    //   console.log(uiSpec)
    // }, [uiSpec]);

     useEffect(() => {
      if(project_id!==''&&project_id!==null){
        saveformuiSpec()
        console.log(formuiSpec)
      }
      
    }, [formuiSpec]);


     const saveformuiSpec = async  () =>{
      try{
          console.log(await setUiSpecForProject(metadata_dbs[project_id].local, formuiSpec));
      }catch (err) {
        console.error('databases needs cleaning...');
        console.debug(err);
      }
    }



    const setinit =()=>{
      
      if(props.project_id!==undefined){
        getUiSpecForProject(props.project_id).then(setUISpec, setError);

      }
      const view=variant_default[0]+sections_default[0]
      const formview=formuiSpec
      formview['views'][view]={'fields':[],uidesign:'form','label':sections_default[0]}
      formview['viewsets']={'FORM1':{views:[view],label:'main'}}
      setFormuiSpec({fields:formuiSpec.fields,views:formview.views,viewsets:formview.viewsets,visible_types:variant_default})

    }



    


    const getnewdb = async  () =>{
      try{
       const p_id=await create_new_project_dbs(projectvalue.projectname);
       if(p_id!==null) setProjectID(p_id);
       console.log(project_id)
      }catch (err) {
      console.error('databases not created...');
      console.log(err);
      }
    }

    const submithandler = (values:any) =>{

    }
    
   
    const handleChangetab = (event:any,index:number) =>{
      setProjecttabvalue(index)
    }


    const handleChangeFormProject=(event:any) => {
      const newproject=projectvalue
      newproject[event.target.name]=event.target.value
      setProjectValue(newproject)
    }

    const submithandlerProject = (values:any) =>{
      //this function is to save project information 
      //TODO currently just save for projectname so added getnewdb function here, need to update it
      if(project_id===''||project_id===null){
        getnewdb();
      }
      console.log(project_id)
    }

  return ( 
    <div className={classes.root}> 
     <AppBar position="static" color='primary'>
          <TabTab tabs={projecttabs} value={projecttabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
      </AppBar>
      <TabPanel value={projecttabvalue} index={0} tabname='primarytab' >
      {'Project Name:'+projectvalue.projectname+' Project ID:'+project_id}
          <FormForm uiSpec={getprojectform(['projectname'])} currentView='start-view' handleChangeForm={handleChangeFormProject} handleSubmit={submithandlerProject}/>
      </TabPanel>
      <TabPanel value={projecttabvalue} index={1} tabname='primarytab' >
      <ProjectDesignTab project_id={project_id} uiSpec={uiSpec} formuiSpec={formuiSpec} setFormuiSpec={setFormuiSpec} />
      </TabPanel>
      <TabPanel value={projecttabvalue} index={2} tabname='primarytab' >
        {projecttabvalue!==2?'':'Project Preview'}
      </TabPanel>
  </div>

  );
}

