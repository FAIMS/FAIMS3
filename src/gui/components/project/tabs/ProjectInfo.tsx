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
import {TickButton} from './ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../../sync/databases';
import {getProjectInfo} from '../../../../databaseAccess';

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
}

export default function ProjectInfoTab(props:ProjectInfoProps) {
  const {projectvalue,setProjectValue,project_id,...others}=props
  const [projectInfo,setProjectInfo]=useState<any>(getProjectInfo(project_id))
  const [infotabvalue,setinfotabvalue]=useState(0)
  const [uiSpec_general,setUISpecG]=useState<uiSpecType>(getprojectform(projectvalue,'info_general'))
  
  const [accessgroup,setaccessgroup]=useState([])
  
  const [uiSpec_access,setUISpecA]=useState<uiSpecType>(getprojectform(projectvalue,'info_group'))
  const [initialValues,setinitialValues]=useState(setProjectInitialValues(uiSpec_access,'start-view',{_id:project_id}))

  useEffect(() => {

     setUISpecA(getprojectform(projectvalue,'info_group'))
     console.log('New user added')
    }, [accessgroup]);

  const handleChangeFormProject=(event:any) => {
      const newproject=projectvalue
      newproject[event.target.name]=event.target.value
      setProjectValue(newproject)
      // console.log(projectvalue)
  }
  const handleChangetab = (event:any,index:number) =>{
      setinfotabvalue(index)
    }

  const handleSubmitAccess = (values:any) =>{
    // props.handleSubmit(values)
    const newproject=projectvalue
    newproject['accesses']=[...newproject['accesses'],values['accessadded']] //need to reset the add user role value
    setProjectValue(newproject)
    setaccessgroup(newproject['accesses'])
    console.log(projectvalue)
  }

  const handleformchangeAccess = (event:any) =>{

  }

  return (
    <Grid container>
    <Grid item sm={8} xs={12}>
    <TabTab tabs={['general','group']} value={infotabvalue} handleChange={handleChangetab}  tab_id='primarytab'/>
    <TabPanel value={infotabvalue} index={0} tabname='primarytab' >
    <FormForm uiSpec={uiSpec_general} currentView='start-view' handleChangeForm={props.handleChangeFormProject} handleSubmit={props.handleSubmit}/>
    <pre>{JSON.stringify(projectInfo, null, 2)}</pre>
    </TabPanel>
    <TabPanel value={infotabvalue} index={1} tabname='primarytab' >
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
                {uiSpec_access['views']['start-view']['fields'].map((fieldName:string)=>
                  getComponentFromField(uiSpec_access,fieldName,formProps,handleformchangeAccess))}
                <TickButton id='submit' type="submit" />
                </Form>
              );
        }}
        </Formik>
    </TabPanel>
    </Grid>
    <Grid item sm={4} xs={12}>
    <pre>{JSON.stringify(projectvalue, null, 2)}</pre>
    </Grid>
    </Grid>
    )
}

