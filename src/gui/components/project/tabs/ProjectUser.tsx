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
 *
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
import {AddUserButton} from './ProjectButton'
type ProjectUserProps={ 
	project_id:string;
	projectvalue:projectvalueType;
  setProjectValue:handlertype;
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


  useEffect(() => {
    const newui=getprojectform(projectvalue,'usersassign')
    
    setinitialValuesassign(setProjectInitialValues(newui,'start-view',{_id:''}));  
    setuiSpecassign(newui); 
    console.log(initialValuesassign)
    console.log('changes')
}, [users]);

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

  const getfield = (usergroup:string,formProps:any,handleChange:any,uiSpec:any) =>{
      return (
     
                <Grid container>
                <Grid item sm={6} xs={12}>
                {usergroup}
                    {getComponentFromField(uiSpec,'users'+usergroup,formProps,handleChange)}
                    
                </Grid>
                <Grid item sm={6} xs={12}>
                    <UserRoleList users={projectvalue.usergroup??[]} deleteuserrole={deleteusers}/>
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
                   <AddUserButton id='submit' type="submit" /> 
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
                <TabTab tabs={['add','groups']} value={tabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
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
                    :'Please add users to active this feature'}
                </TabPanel>
                
            

  </>  
  );
}

