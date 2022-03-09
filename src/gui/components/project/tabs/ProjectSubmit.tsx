/*
 * Copyright 2021, 2022 Macquarie University
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
import {Link as RouterLink} from 'react-router-dom';
import {useState, useEffect} from 'react';
import * as ROUTES from '../../../../constants/routes';
import CircularProgress from '@mui/material/CircularProgress';
import {Grid, Typography, Box, Button} from '@mui/material';
import {ProjectSubmit} from './ProjectButton';
import {ProjevtValueList, FAIMShandlerType} from '../../../../datamodel/ui';
import Alert from '@mui/material/Alert';
import { grey } from '@mui/material/colors';
/* eslint-disable @typescript-eslint/no-unused-vars */

type ProjectSubmitProps = {
  project_id: string | null;
  projectvalue: ProjevtValueList;
  setProjectValue: FAIMShandlerType;
  handleSubmit: FAIMShandlerType;
  handlepublish: FAIMShandlerType;
  formProps: any;
  formuiSpec: any;
};

export default function ProjectSubmitTab(props: ProjectSubmitProps) {
  const {
    projectvalue,
    setProjectValue,
    project_id,
    formuiSpec,
    ...others
  } = props;
  const [isSubmitting, setisSubmitting] = useState(false);
  const [state, seState] = useState(false);
  const [issubmit, setissubmit] = useState(projectvalue.ispublic ?? false);
  const [ischecked, setischecked] = useState(false);

  useEffect(() => {
    checkvalidate();
  }, []);

  const checkvalidate = () => {
    const errors: any = projectvalue.errors;
    errors['formdesign'] = [];
    //check form setting
    formuiSpec['visible_types'].map((viewset: string) =>
      formuiSpec['viewsets'][viewset]['views'].length > 0
        ? formuiSpec['viewsets'][viewset]['views'].map(
            (view: string) =>
              formuiSpec['views'][view]['fields'].length === 0 &&
              errors['formdesign'].push(
                formuiSpec['viewsets'][viewset]['label'] +
                  ' Form > ' +
                  formuiSpec['views'][view]['label'] +
                  ' Section: Section has no component yet,please add it'
              )
          )
        : errors['formdesign'].push(
            formuiSpec['viewsets'][viewset]['label'] +
              ': Form was defined, but section not added'
          )
    );
    if (errors['formdesign'].length > 0) {
      errors['is_valid'] = false;
    } else {
      errors['is_valid'] = true;
    }
    if (props.formProps.isValid && errors['is_valid'] === true)
      setisSubmitting(false);
    else setisSubmitting(true);
    setProjectValue({...projectvalue, errors: {...errors}});
    // check project setting
    setTimeout(() => {
      setischecked(true);
    }, 3000);
  };

  const onButtonClick = async () => {
    //save project value into DB
    if (projectvalue.errors.is_valid === true && props.formProps.isValid) {
      console.log('submit');
      props.handleSubmit();
      setischecked(false);
      seState(true);
      setTimeout(() => {
        setischecked(true);
      }, 5000);
    }
  };

  const onSubmit = () => {
    //save project value into DB
    setissubmit(true);
    setProjectValue({...projectvalue, isrequest: true});
    props.handlepublish();
  };

  return (
    <Grid container>
      <Grid item sm={6} xs={12}>
        {projectvalue.errors.is_valid === true && props.formProps.isValid ? (
          ''
        ) : (
          <Alert severity="error">
            Form has errors, please Check previous Design and make changes
            before re-submitting.
          </Alert>
        )}
        {projectvalue.errors.is_valid === false &&
          projectvalue.errors.formdesign.map((error: string) => (
            <Alert severity="error">{error}</Alert>
          ))}
        {projectvalue.ispublic !== true &&
          //projectvalue.isrequest !== true &&
          issubmit !== true && (
            <ProjectSubmit
              id="submit_save"
              type="submit"
              isSubmitting={isSubmitting}
              issubmittext="Save Notebook "
              text="Save Notebook"
              onButtonClick={onButtonClick}
            />
          )}
        {projectvalue.project_id !== null &&
          projectvalue.project_id !== undefined &&
          ischecked && (
            <Button
              variant="outlined"
              color="primary"
              component={RouterLink}
              onClick={onButtonClick}
              to={ROUTES.PROJECT + project_id}
            >
              Check Notebook
            </Button>
          )}
        {projectvalue.project_id !== null &&
          projectvalue.project_id !== undefined &&
          !ischecked && <CircularProgress size={20} thickness={5} />}
        <Typography>
          {state === true &&
            projectvalue.ispublic !== true &&
            issubmit !== true &&
            'When you’ve finished the design, click the REQUEST RESOURCES button to send the project definition to FAIMS for moderation. Once submitted, the project cannot be edited again until it has been approved. '}
          {state === false &&
            projectvalue.ispublic !== true &&
            issubmit !== true &&
            'Click to save notebook to local device'}
        </Typography>
        {issubmit !== true &&
          projectvalue.ispublic !== true &&
          projectvalue.isrequest !== true && (
            <ProjectSubmit
              id="submit_publish"
              type="button"
              isSubmitting={
                state === false || issubmit === true ? true : isSubmitting
              }
              issubmittext="Request resources"
              text={issubmit !== true ? 'Request resources' : 'Request Sent'}
              onButtonClick={onSubmit}
            />
          )}
        {(issubmit === true && projectvalue.ispublic !== true) ||
          (projectvalue.isrequest === true && (
            <ProjectSubmit
              id="submit_publish"
              type="button"
              isSubmitting={true}
              issubmittext="Request Sent"
              text={'Request Sent'}
              onButtonClick={onSubmit}
            />
          ))}
        <Typography>
          {projectvalue.ispublic === true
            ? 'Notebook is Online Save your new design by Click Update Button'
            : ''}
          {projectvalue.ispublic !== true && state === false
            ? 'Save Notebook Firstly then click Publish Button to send request'
            : ''}
          {projectvalue.ispublic !== true &&
            issubmit === true &&
            'Request is sent, please wait for approve'}
        </Typography>
      </Grid>
      <Grid item sm={6} xs={12}>
        <Box bgcolor={grey[200]} pl={2} pr={2} style={{overflowX: 'scroll'}}>
          <Typography variant={'h6'} component={'h6'}>
            What happens next after SAVE ?
          </Typography>
          <Typography>
            Once your notebook has been saved to your local device, you can get
            it form Notesbooks in menu bar.You can edit it and save it to device
            again later.
          </Typography>
          <Typography variant={'h6'} component={'h6'}>
            What happens next after REQUEST RESOURCES ?
          </Typography>
          <Typography>
            Once your notebook has been approved, users authorised in the User
            tab will receive an email inviting them to join this notebook.
            Approval timescales are around 72 hours, depending on staff
            avaliablity and the current number of requests
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
