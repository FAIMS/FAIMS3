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
 * Filename: SectionComponent.tsx
 * Description:This is the file about Project User Invite
 * TODO: add select to user list area
 */
import React from 'react';
import {useState, useEffect} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Grid, Typography, Paper, Card,Dialog,DialogActions,DialogContent,DialogContentText,DialogTitle,Button} from '@material-ui/core';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {Formik, Form} from 'formik';
import FieldsListCard from './FieldsListCard';
import {SettingCard, FormConnectionCard} from './PSettingCard';
import {
  getComponentFromField,
  FormForm,
  AutocompleteForm,
} from '../FormElement';
import {TabTab, TabEditable} from './TabTab';
import TabPanel from './TabPanel';
import {
  getid,
  updateuiSpec,
  getprojectform,
  uiSpecType,
  getacessoption,
} from '../data/ComponentSetting';
import {ProjevtValueList, FAIMShandlerType} from '../../../../datamodel/ui';
import {
  CloseButton,
  UpButton,
  DownButton,
  AddButton,
  ProjectSubmit,
  ProjectDelete,
} from './ProjectButton';
import {ResetComponentProperties} from '../data/componenentSetting';
import {HRID_STRING} from '../../../../datamodel/core';
import {getValidationSchemaForViewset} from '../../../../data_storage/validation';
import ConfirmdeleteDisalog from './ConfirmdeleteDisalog'
import SectionTabs from './PSections';
/* eslint-disable @typescript-eslint/no-unused-vars */

const useStyles = makeStyles(theme => ({
  newfield: {
    // backgroundColor:'#e1e4e8',
    // borderTop:'1px solid #e1e4e8',
  },
  newfield_button: {
    textAlign: 'right',
  },
  addfield: {
    // border:'1px solid #e1e4e8',
    flexGrow: 1,
    padding: theme.spacing(1),
  },
  settingtab: {
    backgroundColor: '#e1e4e8',
  },
  formtabcard: {
    minHeight: 200,
    backgroundColor: grey[200],
  },
  FieldCard: {
    width: '100%',
  },
}));

const getinitaccess = () => {
  try {
    return ['admin'];
  } catch (error) {
    console.error("can't get access");
    return ['admin'];
  }
};







type FormTabProps={
  formuiSpec:any;
  formvariants:any;
  setFormuiSpec:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  formcomponents:any;
  designvalidate:any;
  fieldvalue:any;
  handleChangetabfield:any;
  handleChangeFormSection:any;
  setfieldValue:any;
  formsectionvalue:any;
  handleAddField:any;
  handleChangeFormAction:any;
  gotonext:any;
  sectiontabs:any;
  handelonChangeSection:any;
  handelonChangeLabelSection:any;
  setProjectValue:any;
  deleteform:any;
  setFormComponents:any;
}




function LiveFormTab (props:FormTabProps){
    const {
        formvariants,
        handleAutocomplete,
        handleChangeFormAction,
        gotonext,
        fieldvalue,
        deleteform,
        ...others}= props
    const handleSubmitFormAction = () =>{

    }

    const [formvalue,setformvalue]=useState(0);

    const handleChangeformvalueTab = (event: any, index: number) => {
      setformvalue(index);
    };

    return (
        <>
        <TabTab
          tabs={['Access', ' Section Definition', 'Advanced']}
          value={formvalue}
          handleChange={handleChangeformvalueTab}
          tab_id="formtab"
        />
        <TabPanel value={formvalue} index={0} tabname="formtab">
          <Grid container>
            <Grid item sm={6} xs={11}>
              <AutocompleteForm
                handleAutocomplete={handleAutocomplete}
                id={formvariants}
                options={getacessoption(props.projectvalue.accesses)}
                labels={props.projectvalue['access']['access' + formvariants]}
                type={'form'}
                uiSpec={getprojectform(props.projectvalue, 'formaccess', {
                  formname: formvariants,
                })}
                currentView="start-view"
                access={props.projectvalue['accesses']}
                handlerChanges={handleChangeFormAction}
              />
            </Grid>
            <Grid item sm={6} xs={1}>
              <Alert severity="info">
                Add the user roles that have access to this form
              </Alert>
            </Grid>
          </Grid>
          <br />
          <ProjectSubmit
            id="gotonext_info"
            type="submit"
            isSubmitting={false}
            text="Go To Next"
            onButtonClick={() => setformvalue(1)}
          />
        </TabPanel>

        <TabPanel value={formvalue} index={2} tabname="formtab">
          {props.projectvalue !== undefined && (
            <FormForm
              currentView="start-view"
              handleChangeForm={handleChangeFormAction}
              handleSubmit={handleSubmitFormAction}
              uiSpec={getprojectform(props.projectvalue, 'form', {
                formname: formvariants,
              })}
            />
          )}
          <ConfirmdeleteDisalog 
            id={formvariants}
            deleteform={deleteform}
            type={'FORM'}
            /><br/><br/>
          <ProjectSubmit
            id="gotonext_info"
            type="button"
            isSubmitting={false}
            text="Go To Next"
            onButtonClick={gotonext}
          />
        </TabPanel>

        <TabPanel value={formvalue} index={1} tabname="formtab">
          <Alert severity="info">
            Add further sections by choosing plus icon. Within each section
            define the components you need.{' '}
          </Alert>
          <SectionTabs 
          formvariants={formvariants}
          handleAutocomplete={handleAutocomplete}
          fieldvalue={fieldvalue}
          deleteform={deleteform}
          {...others}
          />
          {/* {formsectionvalue === sectiontabs.length - 1 &&
            fieldvalue === 1 &&
            props.formuiSpec['views'][props.formuiview]['fields'].length > 0 && (
              <ProjectSubmit
                id="gotonext_info"
                type="button"
                isSubmitting={false}
                text="Go To Next"
                onButtonClick={() => setformvalue(2)}
              />
            )} */}
        </TabPanel>
      </>
    )
}

export function FormTab(props:FormTabProps){
  const undeleteform = (formid:string) =>{
    const newform=props.formuiSpec;
    newform['viewsets'][formid]['isdeleted']=false;
    props.setFormuiSpec({...newform})
  }
  return props.formuiSpec['viewsets'][props.formvariants]['isdeleted']!==true?(
    <LiveFormTab
    {...props} />
  ):(
    <>Form is deleted
    <br/>
    <ProjectDelete
    id={"undeleted"+props.formvariants}
    type="button"
    isSubmitting={false}
    text="UnDelete the form"
    onButtonClick={()=>undeleteform(props.formvariants)}
    />
    </>
  )
}

