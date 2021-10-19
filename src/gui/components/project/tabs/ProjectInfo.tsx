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
 * Filename: ProjectInfo.tsx
 * Description:This is the file about Project Info
 *
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Button, Grid, Box, ButtonGroup, Typography,AppBar,Hidden} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import FieldsListCard from './FieldsListCard';
import {SettingCard} from './PSettingCard';
import {getComponentFromField,FormForm} from '../FormElement';
import {TabTab,TabEditable} from './TabTab';
import TabPanel from './TabPanel';
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform,handlertype,uiSpecType,projectvalueType} from '../data/ComponentSetting'
import {TickButton,AddUserButton,ProjectSubmit} from './ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../../sync/databases';
import {getProjectInfo} from '../../../../databaseAccess';
import {ProjectUIModel,ProjectInformation} from '../../../../datamodel/ui'
import {UserRoleList} from './PSettingCard';
import Alert from '@material-ui/lab/Alert';
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


type ProjectInfoProps={ 
	project_id:string;
	projectvalue:projectvalueType;
  setProjectValue:handlertype;
  handleSubmit:handlertype;
  handleChangeFormProject:handlertype;
  setProjecttabvalue:handlertype;
}

export default function ProjectInfoTab(props:ProjectInfoProps) {
  const {projectvalue,setProjectValue,project_id,...others}=props
  // const [projectInfo,setProjectInfo]=useState<ProjectInformation|null>(getProjectInfo(project_id))
  const [infotabvalue,setinfotabvalue]=useState(0)
  const [uiSpec_general,setUISpecG]=useState<ProjectUIModel>({fields:{},views:{},viewsets:{},visible_types:[]})
  
  const [accessgroup,setaccessgroup]=useState([])
  
  const [uiSpec_access,setUISpecA]=useState<ProjectUIModel>({fields:{},views:{},viewsets:{},visible_types:[]})
  const [initialValues,setinitialValues]=useState<any>({})

  useEffect(() => {
     setini();
    }, []);

  useEffect(() => {

     setUISpecA(getprojectform(projectvalue,'info_group'))
    }, [accessgroup]);

  useEffect(() => {
    if(projectvalue['name']!==undefined&&projectvalue['name']!==''){
      const newuiSpecg=getprojectform(projectvalue,'info_general')
      const newini=setProjectInitialValues(newuiSpecg,'start-view',{_id:project_id})
      setinitialValues(setProjectInitialValues(newuiSpecg,'start-view',{_id:project_id}))
      console.debug(initialValues)
      setUISpecG(newuiSpecg)
      console.debug('update')
      console.log(newuiSpecg)
    }
    }, [projectvalue]);

  const setini = () =>{
    setUISpecA(getprojectform(projectvalue,'info_group'))
    
    const iniuiSpecg=getprojectform(projectvalue,'info_general')
    const ini=setProjectInitialValues(iniuiSpecg,'start-view',{_id:project_id})
    setinitialValues(setProjectInitialValues(iniuiSpecg,'start-view',{_id:project_id}))
    console.debug(initialValues)
    setUISpecG({...iniuiSpecg})
    console.debug('ini')
    setinfotabvalue(0)

  }

  const handleChangeFormProject=(event:any) => {
      const newproject=projectvalue
      newproject[event.target.name]=event.target.value
      setProjectValue({...newproject})
  }
  const handleChangetab = (event:any,index:number) =>{
     
      if(index===0) setinitialValues(setProjectInitialValues(uiSpec_general,'start-view',{_id:project_id}))
      if(index===1) setinitialValues(setProjectInitialValues(uiSpec_access,'start-view',{_id:project_id}))
        console.log(initialValues)
       setinfotabvalue(index)
    }

  const handleSubmitAccess = (values:any) =>{
    // props.handleSubmit(values)
    if(values['accessadded']==='') return false;
    const newproject=projectvalue
    newproject['accesses']=[...newproject['accesses'],values['accessadded']] //need to reset the add user role value
    setProjectValue(newproject)
    setaccessgroup(newproject['accesses'])
    return true;
  }

  const handleformchangeAccess = (event:any) =>{

  }

  const deleteuserrole = (userrole:string) =>{
    console.log(userrole);
    const newproject=projectvalue
    newproject['accesses']=newproject['accesses'].filter((access:string)=>access!==userrole)
    setProjectValue(newproject)
    setaccessgroup(newproject['accesses'])
  }

  return (
    <Grid container>
      <Grid item sm={12} xs={12}>
        <TabTab tabs={['general','User Role']} value={infotabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
        <TabPanel value={infotabvalue} index={0} tabname='primarytab' >
        <Grid container>
        <Grid item sm={8} xs={12}>
          {(project_id!==undefined&&projectvalue.name!==''&&projectvalue.name!==undefined&&initialValues.name!=='')||project_id===undefined?<Formik
          initialValues={initialValues}
          validateOnMount={true}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              props.handleSubmit(values)
            }, 500);}}
          >
            {formProps => {
              return (
                <Form >
                {uiSpec_general['views']['start-view']!==undefined?uiSpec_general['views']['start-view']['fields'].map((fieldName:string)=>
                  getComponentFromField(uiSpec_general,fieldName,formProps,handleChangeFormProject)):''}
                {/* <TickButton id='submit' type="submit" /> */}
                <br/>
                <ProjectSubmit id='gotonext_info' type='submit' isSubmitting={false} text='Go To Next' onButtonClick={()=>setinfotabvalue(1)} />
                </Form>
              );
            }}
          </Formik>:''}<br/>
          </Grid>
          <Grid item sm={4} xs={12}>
                <Alert severity="info">Give project a name and an description</Alert>
            
          </Grid>
          </Grid>
        </TabPanel>
        <TabPanel value={infotabvalue} index={1} tabname='primarytab' >
        <Grid container>
        <Grid item sm={8} xs={12}>
        {infotabvalue===1?
        <Grid container>
          <Grid item sm={6} xs={12}>
          <Formik
          initialValues={initialValues}
          validateOnMount={true}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              handleSubmitAccess(values)
            }, 500);}}
          >

            {formProps => {
              return (
                <Form >
                {uiSpec_access['views']['start-view']!==undefined?uiSpec_access['views']['start-view']['fields'].map((fieldName:string)=>
                  getComponentFromField(uiSpec_access,fieldName,formProps,handleformchangeAccess)):''}
                <AddUserButton id='submit' type="submit" />
                </Form>
              );
            }}
          </Formik>
          </Grid>
          <Grid item sm={1} xs={12}>
          </Grid>
          <Grid item sm={5} xs={12}>
          <UserRoleList users={projectvalue.accesses} deleteuserrole={deleteuserrole}/>
          </Grid>
          </Grid>
          :''}
          </Grid>
          <Grid item sm={4} xs={12}>
            <Alert severity="info">All projects have an admin, moderator, and team roles by default. define any  new roles required here. You will be able to assign users to these roles later in the User tab.</Alert>
          </Grid>
          <ProjectSubmit id='gotonext_info' type='submit' isSubmitting={false} text='Go To Next' onButtonClick={()=>props.setProjecttabvalue(1)} />
          </Grid>
        </TabPanel>
        </Grid>
    </Grid>
  )}

