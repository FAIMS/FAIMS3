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
 * Filename: ProjectSubmit.tsx
 * Description:This is the file about Project Info
 *
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Grid,Typography,Box} from '@material-ui/core';
import {ProjectSubmit} from './ProjectButton';
import {handlertype,uiSpecType,projectvalueType} from '../data/ComponentSetting'
import Alert from '@material-ui/lab/Alert';

type ProjectSubmitProps={ 
	project_id:string;
	projectvalue:projectvalueType;
  setProjectValue:handlertype;
  handleSubmit:handlertype;
  handlepublish:handlertype;
}

export default function ProjectSubmitTab(props:ProjectSubmitProps) {
  const {projectvalue,setProjectValue,project_id,...others}=props
  const [isSubmitting,setisSubmitting]=useState(false)
  const [state,seState]=useState(false)
  const [issubmit,setissubmit]=useState(projectvalue.ispublic??false)


  const onButtonClick = () => {
    //save project value into DB
    console.log('submit')
    props.handleSubmit()
    seState(true)
  }

  const onSubmit = () => {
    //save project value into DB
    setissubmit(true)
    props.handlepublish();
  }

  return (

    <Grid container>
      <Grid item sm={6} xs={12}>
      {projectvalue.errors!==undefined&&projectvalue.errors.length>0?
      <Alert severity="error">
      Form has errors, please Check previous Design and make changes
                            before re-submitting.
      </Alert>
      :''}
        {projectvalue.ispublic!==true &&issubmit!==true&& <ProjectSubmit id='submit_save' type='submit' isSubmitting={isSubmitting} text='Save' onButtonClick={onButtonClick} />}
        <Typography>{state===true&&projectvalue.ispublic!==true&&issubmit!==true&&'When you’ve finished the design, click the REQUEST RESOURCES button to send the project definition to FAIMS for moderation. Once submitted, the project cannot be edited again until it has been approved. '}
        {state===false&&projectvalue.ispublic!==true&&issubmit!==true&&'Click to save notebook to local device'}
        </Typography>
        {issubmit!==true&&projectvalue.ispublic!==true && <ProjectSubmit id='submit_publish' type='submit' isSubmitting={state===false||issubmit===true?true:isSubmitting} issubmittext='Request resources' text={issubmit!==true ?'Request resources':'Request Sent'} onButtonClick={onSubmit} />}
        {issubmit===true&&projectvalue.ispublic!==true && <ProjectSubmit id='submit_publish' type='submit' isSubmitting={true} issubmittext='Request Sent' text={'Request Sent'} onButtonClick={onSubmit} />}
        <Typography>{projectvalue.ispublic===true?'Notebook is Online Save your new design by Click Update Button': ''}
        {projectvalue.ispublic!==true&&state===false?'Save Notebook Firstly then click Publish Button to send request': ''}
        {projectvalue.ispublic!==true&&issubmit===true&&'Request is sent, please wait for approve'}
        </Typography>
      </Grid>
      <Grid item sm={6} xs={12}>
         <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
            <Typography variant={'h6'} component={'h6'}>
            What happens next after SAVE ?
            </Typography>
            <Typography >
            Once your notebook has been saved to your local device, you can get it form Notesbooks in menu bar.You can edit it and save it to device again later.
            </Typography>
            <Typography variant={'h6'} component={'h6'}>
            What happens next after REQUEST RESOURCES ?
            </Typography>
            <Typography >
            Once your notebook has been approved, users authorised in the User tab will receive an email inviting them to join this notebook. Approval timescales are around 72 hours, depending on staff avaliablity and the current number of requests
            </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}

