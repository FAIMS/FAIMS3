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
 * Filename: ProjectUser.tsx
 * Description:This is the file about Project User Invite
 * TODO: add select to user list area
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';

import {Grid,Typography,Box} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import {getComponentFromField,FormForm} from '../FormElement';
import {ProjectSubmit} from './ProjectButton';
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform,handlertype,uiSpecType,projectvalueType} from '../data/ComponentSetting'
import Alert from '@material-ui/lab/Alert';
import {TabTab} from './TabTab';
import TabPanel from './TabPanel';
import {UserRoleList} from './PSettingCard';
import {AddUserButton,Addusersassign} from './ProjectButton'
type ProjectUserProps={ 
	project_id:string;
	projectvalue:projectvalueType;
  setProjectValue:handlertype;
  setProjecttabvalue:handlertype;
//   handleSubmit:handlertype;
//   handlepublish:handlertype;
}
type UsergroupTYpe=any;

export default function ProjectUserTab(props:ProjectUserProps) {
  const {projectvalue,setProjectValue,project_id,...others}=props
  const [usergroups,setusergroups]=useState<UsergroupTYpe>(projectvalue.accesses)
  const [uiSpec,setuiSpec]=useState(getprojectform(projectvalue,'users'));
  const [uiSpecassign,setuiSpecassign]=useState(getprojectform(projectvalue,'usersassign'));
  const [initialValues,setinitialValues]=useState(setProjectInitialValues(uiSpec,'start-view',{_id:''}))
  const [initialValuesassign,setinitialValuesassign]=useState(setProjectInitialValues(uiSpecassign,'start-view',{_id:''}))
  const [tabvalue,settatbValue]=useState(0)
  const [users,setusesers]=useState(projectvalue.users)
  const [selectusers,setselectusers]=useState<any>({})


//   useEffect(() => {
//     const newui=getprojectform(projectvalue,'usersassign')
    
//     setinitialValuesassign(setProjectInitialValues(newui,'start-view',{_id:''}));  
//     setuiSpecassign(newui); 
//     console.log(initialValuesassign)
    
// }, [users]);

// useEffect(() => {
    
//     console.log('changes')
// }, [selectusers]);

  const handleChange = (event:any) => {
    //save project value into DB
    console.log(event.target.name)
    
    // props.handleSubmit()
  }

  const handleChangetab = (event:any,index:number) =>{
    setinitialValues(setProjectInitialValues(uiSpec,'start-view',{_id:''}));
    setinitialValuesassign(setProjectInitialValues(uiSpecassign,'start-view',{_id:''}));
    settatbValue(index)
  }

  const handlerassignuser = (role:string) =>{
    const newproject=projectvalue
    newproject[role]=users   //selectusers[role]
    setProjectValue({...newproject})
      const news=selectusers
      news[role]=users
      setselectusers({...news})
      console.log(projectvalue)
  }

  const handleSubmit = (values:any) =>{
    console.log('values')
  } 

  const addusers = (values:any) => {
    const users=values['users'].split(/\r?\n/);
    const newproject=projectvalue
    if(newproject['users']===undefined) {
        newproject['users']=users
        usergroups.map((user:string)=>newproject[user]=[]

        )
    }
    else {
        newproject['users']=[...newproject['users'],...users]
    }
    setProjectValue({...projectvalue,users:newproject['users']}) //TODO: add to check if duplicated user
    setusesers(newproject['users'])
  }

  const deleteusers = (index:string) =>{
      console.log(index)
  }

  const deleteusersassign = (user:string)=>{
    console.log(user)
  }

  const getfield = (usergroup:string,formProps:any,handleChange:any,uiSpec:any) =>{
      return (
     
                <Grid container >
                    
                <Grid item sm={4} xs={12} >
                <br/>
                <Typography variant="subtitle2">All users</Typography>
                    <UserRoleList users={projectvalue.users??[]} delete={false} />
                    
                </Grid>
                <Grid item sm={1} xs={12}><br/><Addusersassign onButtonClick={handlerassignuser} value={usergroup}/></Grid>
                <Grid item sm={7} xs={12}><br/>
                <Typography variant="subtitle2">Role: {usergroup} </Typography>
                    <UserRoleList users={projectvalue[usergroup]??[]} deleteuserrole={deleteusersassign}/>
                </Grid>
                </Grid>
                
        
      )
  }

  const assigntab = (usergroups:Array<string>,handleSubmit:any,handleChange:any,uiSpec:any,initialValuesassign:any) =>{
    return (
        <Formik
        initialValues={initialValuesassign}
        validateOnMount={true}
        onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              handleSubmit(values)
            }, 500);}}
    >
    {formProps => {
        return (
            <Form >
                {usergroups.map((usergroup:string)=>
            getfield(usergroup,formProps,handleChange,uiSpec)
         )}
                
            </Form>
            );
        }}
    </Formik>
    )
  }

  const addtab = (uiSpec:any,handleSubmit:any,handleChange:any) => {
      return (
        <Formik
        initialValues={initialValues}
        validateOnMount={true}
        onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              handleSubmit(values)
            }, 500);}}
    >
    {formProps => {
        return (
            <Form >
                <Grid container>
                <Grid item sm={6} xs={12}>
                {
                    uiSpec['views']['start-view']!==undefined?uiSpec['views']['start-view']['fields'].map((fieldName:string)=>
                    getComponentFromField(uiSpec,fieldName,formProps,handleChange)):''
                }
                <Box
                pl={2}
                pr={2}
                ><AddUserButton id='submit' type="submit" /></Box> 
                <Box
                pl={2}
                pr={2}
                >{projectvalue.users!==undefined?<ProjectSubmit id='gotonext_info' type='submit' isSubmitting={false} text='Go To Next' onButtonClick={()=>settatbValue(1)} />:''}</Box> 
                </Grid>
                
                <Grid item sm={6} xs={12}>
                    <UserRoleList users={projectvalue.users??[]} deleteuserrole={deleteusers}/>
                </Grid>
                </Grid>
                
            </Form>
            );
        }}
    </Formik>
      )
  }

  return (
    <>
                <TabTab tabs={['add','User Role']} value={tabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
                <TabPanel value={tabvalue} index={0} tabname='primarytab' >
                    {addtab(uiSpec,addusers,handleChange)}
                </TabPanel>
                <TabPanel value={tabvalue} index={1} tabname='primarytab' >
                    {tabvalue===1&&projectvalue.users!==undefined?
                     <Formik
                     initialValues={initialValuesassign}
                     validateOnMount={true}
                     onSubmit={(values, {setSubmitting}) => {
                         setTimeout(() => {
                           setSubmitting(false);
                           handleSubmit(values)
                         }, 500);}}
                 >
                 {formProps => {
                     return (
                         <Form >
                             {usergroups.map((usergroup:string)=>
                         getfield(usergroup,formProps,handleChange,uiSpecassign)
                      )}
                             
                         </Form>
                         );
                     }}
                 </Formik>
                    :'Please add users to activate this feature'}
                    <ProjectSubmit id='gotonext_info' type='submit' isSubmitting={false} text='Go To Next' onButtonClick={()=>props.setProjecttabvalue(5)} />
                </TabPanel>
                
            

  </>  
  );
}

