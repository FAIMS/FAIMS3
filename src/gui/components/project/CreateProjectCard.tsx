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
 * Description: No autosync in Notebook creation/edit in this Stage
 *   TODO: seperate the tabs to different files
 *   TODO: edit Project is not working, can't read information for project
 *   TODO: setup project information 
 *     TODO:  preview, User, Behaviour, submit
 *   TODO: swith the form component, need to change to drag element
 *   TODO: sync into and save to DB(??)
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import { Grid,AppBar} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import {TabTab,TabEditable} from './tabs/TabTab';
import TabPanel from './tabs/TabPanel';
import ProjectDesignTab from './tabs/ProjectDesign';
import ProjectInfoTab from './tabs/ProjectInfo';
import {handlertype,uiSpecType,projectvalueType} from './data/ComponentSetting'
import {setUiSpecForProject,getUiSpecForProject} from '../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../sync/databases';
import {ProjectUIModel,ProjectInformation} from '../../../datamodel/ui'
import {create_new_project_dbs}  from '../../../sync/new-project'
import {getProjectInfo} from '../../../databaseAccess';
import {setProjectMetadata} from '../../../projectMetadata';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },

}));


type CreateProjectCardProps={
  project_id:string;
  uiSpec:uiSpecType|null;
  project_info:ProjectInformation | null
}

const accessgroup=['admin','moderator','team']

const sections_default=['SECTION1']
const variant_default=['FORM1']
const projecttabs=['Info','Design','Preview']
const variant_label='main'

export default function CreateProjectCard(props:CreateProjectCardProps) {
    // if(props.project_id===undefined) console.log('New Project'+props.project_id)
    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const [project_id,setProjectID]=useState(props.project_id);
    const [projectvalue,setProjectValue]=useState<projectvalueType>({accesses:accessgroup,project_id:project_id})
    const [initialValues,setinitialValues]=useState(ini)
    const [projectuiSpec,setProjectuiSpec] = useState<Array<any>>()
    const [projecttabvalue,setProjecttabvalue]=useState(-1)
    // const [uiSpec,setUISpec]=useState<uiSpecType|null>(props.uiSpec)
    const [formuiSpec,setFormuiSpec]=useState<ProjectUIModel>({fields:{},views:{},viewsets:{},visible_types:[]})
    const [formtabs,setformTabs]=useState<Array<string>>([])    
    const [error, setError] = useState(null as null | {});

    // const [projectInfo,setProjectInfo]=useState<any>()



    useEffect(() => {

     setinit();

    }, []);

    useEffect(() => {

      setinit();
      setProjectID(props.project_id)
      console.debug('change project_id')

    }, [props.project_id]);

    useEffect(() => {
      if(props.uiSpec!==null) {
        setFormuiSpec(props.uiSpec);
        console.debug('change project_ui for edit')
      }else{
        setinit();
        console.debug('change project_ui for add')
      }
      
    }, [props.uiSpec]);

    useEffect (()=>{
      if(props.project_info!==undefined&&props.uiSpec!==null){
        setProjectValue({...projectvalue,...props.project_info});
      }else setProjectValue({accesses:accessgroup})
    },[props.project_info])


    //  useEffect(() => {
    //   if(project_id!==''&&project_id!==null&&Object.keys(formuiSpec['fields']).length!==0){
    //     saveformuiSpec()
    //     console.log('save to DB')
    //   }
      
      
    // }, [formuiSpec]);


     const saveformuiSpec = async  () =>{
      try{
          console.log(await setUiSpecForProject(metadata_dbs[project_id].local, formuiSpec));
      }catch (err) {
        console.error('databases needs cleaning...');
        console.debug(err);
      }
    }



    const setinit =()=>{
      
      if(props.uiSpec===null){
        console.log('setup')
        //if create new notebook then set an empty formUI
        const view=variant_default[0]+sections_default[0]
        const formview=formuiSpec
        formview['fields']={}
        formview['views']={}
        formview['viewsets']={}
        const fields:string[]=[]
        formview['views'][view]={'fields':fields,uidesign:'form','label':sections_default[0]}
        formview['viewsets']={'FORM1':{views:[view],label:variant_label}}
        setFormuiSpec({fields:formview.fields,views:formview.views,viewsets:formview.viewsets,visible_types:variant_default})
      }

      if(props.project_id===undefined) {setProjectValue({accesses:accessgroup}); console.log('No project ID')}

      // if(project_id!==undefined) setProjectInfo(getProjectInfo(project_id))

      setProjecttabvalue(0)

    }



    


    const getnewdb = async  () =>{
      try{
       const p_id=await create_new_project_dbs(projectvalue.name);
       if(p_id!==null) {setProjectID(p_id); setProjectValue({...projectvalue,project_id:p_id})}
      }catch (err) {
      console.error('databases not created...');
      console.log(err);
      }
    }

    const updateproject = async (values:any) =>{
      try{
        for (const key in values) {
          if(key!=='name'){ //TODO: check if name can editable or not
            try {
              console.log(await setProjectMetadata(project_id, key, values[key]));
              console.log('update'+key)
            } catch (err) {
              console.error('databases needs cleaning...');
              console.debug(err);
            }
          }
        
      }
        
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
      if(project_id===undefined){
        getnewdb();
      }else{
        updateproject(values);
      }
    }

    const handleSaveUiSpec = () =>{
      if(project_id!==''&&project_id!==null&&Object.keys(formuiSpec['fields']).length!==0){
        saveformuiSpec()
      }
    }

  return ( 
    <div className={classes.root}> 
     <AppBar position="static" color='primary'>
          <TabTab tabs={projecttabs} value={projecttabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
      </AppBar>
      <TabPanel value={projecttabvalue} index={0} tabname='primarytab' >
        {projecttabvalue===0?  <ProjectInfoTab project_id={project_id} projectvalue={projectvalue} setProjectValue={setProjectValue} handleChangeFormProject={handleChangeFormProject} handleSubmit={submithandlerProject}/>:''}
      </TabPanel>
      <TabPanel value={projecttabvalue} index={1} tabname='primarytab' >
        {projecttabvalue===1?<ProjectDesignTab project_id={project_id} accessgroup={projectvalue.accesses} projectvalue={projectvalue} setProjectValue={setProjectValue} formuiSpec={formuiSpec} setFormuiSpec={setFormuiSpec} handleSaveUiSpec={handleSaveUiSpec} />:''}
      </TabPanel>
      <TabPanel value={projecttabvalue} index={2} tabname='primarytab' >
        {projecttabvalue===2?'Project Preview':''}
      </TabPanel>
  </div>

  );
}

