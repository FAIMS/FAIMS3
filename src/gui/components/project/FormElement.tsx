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
 * Filename: form.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import { useState, useEffect } from 'react'
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import {Button, Grid, Box, ButtonGroup, Typography} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import {getComponentByName} from '../../ComponentRegistry';
import PSettingCard from './tabs/PSettingCard';

type FormElement = {
  // project_id: string;
  // revision_id?: string;
  // is_fresh: boolean;
  view:string|'start_view';
  uiSpec:any,
  formProps:any,
  handleChangeForm:any,
  // fieldNames:any
};


export default function FormElement (props: FormElement){

  const [currentView, setCurrentView] = useState(props.view);
  const [designvalue,setDesignvalue] = useState(1);
  const [uiSpec,setUISpec] = useState(props.uiSpec); 
  const formProps=props.formProps;
  const [fieldNames,setFieldNames]=useState<Array<any>>(uiSpec['views'][currentView]['fields'])
  const [uidesign,setuidesign]=useState<string>(uiSpec['views'][currentView]['uidesign'])

  const setnewPage = () =>{
    // This method is to change form uispecific when uispecific changes=> inital value, uiSpefic, views
    setFieldNames(uiSpec['views'][currentView]['fields'])
    setuidesign(uiSpec['views'][currentView]['uidesign'])
  }


  // useEffect(() => {
  //   console.log('ui changes')
  //   console.log(uiSpec)

  //    setnewPage()
  //   }, [uiSpec,currentView]);

  const getComponentFromField = (fieldName: string,formProps:any,uidesign='alert') =>{
    // console.log('getComponentFromField');
    
    const fields = uiSpec['fields'];
    const fieldConfig=fields[fieldName]
    const namespace = fieldConfig['component-namespace'];
    const name = fieldConfig['component-name'];
    let Component: React.Component;
    try {
        Component = getComponentByName(namespace, name);
    } catch (err) {
        return (<></>);
    }
    const value=formProps.values[fieldName]
    
      return (
      
      <Box mb={3} key={fieldName}>
        <Field
          component={Component} 
          name={fieldName}
          onChange={(e:React.FocusEvent<{name: string}>)=> {
           formProps.handleChange(e);
           handleChangeC(e)
          }}
          onBlur={(e:React.FocusEvent<{name: string}>)=> {
           formProps.handleChange(e);
           handleChangeC(e)
          }}
          value={value}
          {...fieldConfig['component-parameters']}
          {...fieldConfig['component-parameters']['InputProps']}
          {...fieldConfig['component-parameters']['SelectProps']}
          {...fieldConfig['component-parameters']['InputLabelProps']}
          {...fieldConfig['component-parameters']['FormHelperTextProps']}
        />
      </Box>
     );
    
  }
   const handelonClickSetting = (id:any) => {
    setDesignvalue(id)
  }

  const handleChangeC = (event:any) => {
     props.handleChangeForm(event)
   }
  return (
    <React.Fragment>
    {uidesign==='form'?
      fieldNames.map(fieldName => {
        return getComponentFromField(fieldName, formProps,uidesign);
        }):
      <Grid container spacing={1} >
        <Grid item sm={4} xs={12} >
          {fieldNames.length>0?getComponentFromField(fieldNames[0], formProps):''}
        </Grid>
        <Grid item sm={1} xs={3} >          
          <PSettingCard handelonClick={handelonClickSetting} />       
        </Grid>
        <Grid item sm={7} xs={9}>
          {uidesign==='settings'?fieldNames.length>designvalue+1?
            [designvalue,designvalue+1].map(value => {
              return getComponentFromField(fieldNames[value], formProps,uidesign);
            }):''
            :getComponentFromField(fieldNames[1], formProps,'alert')
          }
        </Grid>
      </Grid>
    }         
    </React.Fragment>
    );
  
}

