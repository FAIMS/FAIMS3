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
 * Filename: Annotatio.tsx
 * Description:
 *   TODO
 */

import React, { useState } from 'react';
import {FieldProps} from 'formik';
import {Button, IconButton} from '@material-ui/core';
import NoteIcon from '@material-ui/icons/Note';
import LiveHelpIcon from '@material-ui/icons/LiveHelp';
import {generatenewfield} from '../project/data/componenentSetting';
import { UpButton,DownButton } from '../project/tabs/ProjectButton';
import {getComponentByName} from '../../component_registry';
import {Field, FormikProps} from 'formik';
export function Annotation(props: any) {
    const {field,fieldName,handerannoattion}=props
  const [isclicked,setIsClick]=useState(false)
  const fields=generatenewfield('formik-material-ui','TextField',null,fieldName+'annotation',null) //{'annotation':'','uncertainty':false}
  const [annotation,setAnnotation]=useState(props.annotation!==undefined?props.annotation[fieldName]['annotation']:'') //props.annotation!==undefined?props.annotation[props.fieldName]['annotation']:
  const [uncertainty,setUncertainty]=useState(props.annotation!==undefined?props.annotation[fieldName]['uncertainty']:true)
  const handlerchangesAnnotation = (event:any) =>{
        const value=event.target.value
        setAnnotation(event.target.value)
        handerannoattion(event.target.name.replace('annotation',''),value,'annotation')

  }

  const handlerchangesUncertainty = (event:any) =>{
    const value=!uncertainty
    setUncertainty(value)
    handerannoattion(event.target.name.replace('uncertainty',''),value,'uncertainty')
  }
    return (
      <>
      {field.meta!==undefined&&
      <IconButton
        edge="end"
        onClick={()=>setIsClick(true)}
      >
        <NoteIcon fontSize="small" />
      </IconButton>}
      {field.meta!==undefined&&isclicked&&
        <UpButton
            onButtonClick={()=>setIsClick(false)}
            value={1}
            id={1}
        />}
        {field.meta!==undefined&&!isclicked&&
        <DownButton
            onButtonClick={()=>setIsClick(true)}
            value={2}
            id={3}
        />}<br/>
      {field.meta!==undefined&&isclicked&&
      <Field
        component={getComponentByName('formik-material-ui','TextField')} //e.g, TextField (default <input>)
        name={props.fieldName+'annotation'}
        id={props.fieldName+'annotation'}
        value={annotation}
        variant='outlined'
        onChange={handlerchangesAnnotation}
        InputProps={{type:'text'}}
        label={field['meta']['annotation_label']}
      />}
      {field.meta!==undefined&&field.meta['uncertainty']!==undefined&&!field['meta']['uncertainty']['include']&&isclicked&&
      <Field
        component={getComponentByName('faims-custom','Checkbox')} //e.g, TextField (default <input>)
        name={props.fieldName+'uncertainty'}
        id={props.fieldName+'uncertainty'}
        type= 'checkbox'
        value={uncertainty}
        variant='outlined'
        FormControlLabelProps={{label:field['meta']['uncertainty']['label']}}
        onChange={handlerchangesUncertainty}
      />}<br/><br/>
      </>
    );
}

