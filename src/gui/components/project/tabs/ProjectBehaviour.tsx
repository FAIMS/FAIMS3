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
 * Filename: ProjectBehaviour.tsx
 * Description:This is the file about Notebook Behavoiur
 *   TODO: 
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Button, Grid, Box, ButtonGroup, Typography,AppBar,Hidden,Paper,Slider} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import FieldsListCard from './FieldsListCard';
import {SettingCard,FormConnectionCard} from './PSettingCard';
import {getComponentFromField,FormForm} from '../FormElement';
import {TabTab,TabEditable} from './TabTab';
import TabPanel from './TabPanel';
import {setProjectInitialValues,getid,updateuiSpec,gettabform,getprojectform,handlertype,uiSpecType,projectvalueType,getacessoption} from '../data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton,AddButton} from './ProjectButton'
import {setUiSpecForProject,getUiSpecForProject} from '../../../../uiSpecification';
import {data_dbs, metadata_dbs} from '../../../../sync/databases';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';




type ProjectBehaviourProps=any

export default function ProjectBehaviourTab(props:ProjectBehaviourProps) {

    const {project_id,setProjectValue,projectvalue,...others}=props
    
    
    const handleChange = () =>{

    }

    const handleSubmit = () => {

    }


    

  return (
        <Grid container>
            <Grid item sm={4} xs={1}>
            <Typography variant={'h6'} component={'h6'}>
            Automatic Updates
            </Typography>
            <Typography >
            Automatically save changes the user makes as they occur. 
            Automatically retrive changes made by other users every 30s (if online)
            </Typography >
            </Grid>
           <Grid item sm={1} xs={1} >
            <Slider disabled
            value={100}
            onChange={handleChange}
            aria-labelledby="Automatic Updates"
            color="primary"   
            />
            </Grid>
        </Grid>

  );
}

