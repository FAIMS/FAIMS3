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
/* eslint-disable @typescript-eslint/no-unused-vars */
type SectionComponent = {
  formuiSpec:any;
  formcomponent:any;
  formvariants:any;
  setFormuiSpec:any;
  formProps:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  index:number;
  handleUpFieldButton:any;
  handleDownFieldButton:any;
  formcomponents:any;
  handleRemoveField:any;};

function SectionComponent(props: SectionComponent) {
    const theme = useTheme();
    const classes = useStyles(theme);
    const {
        formuiSpec,
        formcomponent,
        formvariants,
        setFormuiSpec,
        formProps,
        formuiview,
        initialValues,
        setinitialValues,
        projectvalue,
        handleAutocomplete,
        index,
        handleUpFieldButton,
        handleDownFieldButton,
        formcomponents,
        handleRemoveField}= props
  const fieldName=formcomponent['id'];
  const [designvalue,setDesignValue]= useState('settings')

  const handelonChangeSetting = (index: string, key: string) => {
    setDesignValue(index)
  };

  return (<>
    <Card className={classes.FieldCard}>
      <Grid
        container
        className={classes.newfield}
        key={`formcompoenet-form-${fieldName}`}
      >
        <Grid item sm={10} xs={12}>
          <Grid container spacing={1}>
            <Grid item sm={4} xs={12}>
              <Typography variant="subtitle2">
                {formuiSpec['fields'][fieldName] !== undefined &&
                formuiSpec['fields'][fieldName][
                  'component-parameters'
                ]['hrid'] === true
                  ? 'Unique Human Readable ID:' + HRID_STRING + formvariants
                  : fieldName}
              </Typography>
              {getComponentFromField(
                formuiSpec,
                fieldName,
                formProps,
                () => {} //this is preview field only, so no need to handler changes
              )}
            </Grid>
            <Grid item sm={1} xs={3} className={classes.settingtab}>
              <SettingCard
                handelonClick={handelonChangeSetting}
                key_id={formcomponent.id}
                selected={designvalue}
              />
            </Grid>
            <Grid item sm={7} xs={9}>
              <Typography variant="subtitle2">Configuration</Typography>
              {!(
                designvalue === 'meta' &&
                formuiSpec['fields'][fieldName]['meta'] ===
                  undefined
              ) && (
                <ResetComponentProperties
                  namespace={formcomponent['namespace']}
                  componentName={formcomponent['componentName']}
                  uiSpec={formuiSpec}
                  setuiSpec={setFormuiSpec}
                  fieldName={fieldName}
                  formProps={formProps}
                  designvalue={designvalue}
                  currentview={formuiview}
                  currentform={formvariants}
                  initialValues={initialValues}
                  setinitialValues={setinitialValues}
                  projectvalue={projectvalue}
                />
              )}
              
              {designvalue === 'access' ? (
                <AutocompleteForm
                  id={fieldName}
                  options={getacessoption(
                    props.projectvalue['access']['access' + formuiview] ?? [
                      'admin',
                    ]
                  )}
                  labels={
                    formuiSpec['fields'][fieldName]['access']
                  }
                  handleAutocomplete={handleAutocomplete}
                  type={'uiS'}
                />
              ) : (
                ''
              )}
            </Grid>
          </Grid>
        </Grid>
        <Grid item sm={2} xs={12} className={classes.newfield_button}>
           {index > 0 && (
            <UpButton
              onButtonClick={handleUpFieldButton}
              value={index}
              id={index}
              text="X"
            />
          )}
          {index < formcomponents[formuiview].length - 1 ? (
            <DownButton
              onButtonClick={handleDownFieldButton}
              value={index}
              id={index}
              text="X"
            />
          ) : (
            ''
          )} 
          <CloseButton
            onButtonClick={handleRemoveField}
            value={formcomponent.id}
            id={formcomponent.id}
            text="X"
          />
        </Grid>
      </Grid>
    </Card>
    <Grid item sm={10} xs={12}>
      <br />
    </Grid>
  </>)
}

type SectionComponentsProps= {
  formuiSpec:any;
  formvariants:any;
  setFormuiSpec:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  handleUpFieldButton:any;
  handleDownFieldButton:any;
  formcomponents:any;
  handleRemoveField:any;
  designvalidate:any;
}

function SectionComponents(props: SectionComponentsProps){
    const {
        designvalidate,
        formcomponents,
        formuiview,
        initialValues,...others}= props
     const submithandler = (values:any) =>{

     }
    return (
        <Formik
          // enableReinitialize
          key={formuiview}
          initialValues={initialValues}
          validateOnMount={true}
          validationSchema={designvalidate}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              submithandler(values);
            }, 500);
          }}
        >
          {formProps => {
            return (
              <Form>
                {formProps.isValid === false && (
                  <Alert severity="error">
                    Form has errors, please fill required field in settings for
                    each component.
                  </Alert>
                )}
                {formcomponents[formuiview].map((formcomponent: any, index: any) =>
                <SectionComponent
                formuiview={formuiview}
                initialValues= {initialValues}
                formcomponent={formcomponent}
                index={index}
                formProps={formProps}
                formcomponents={formcomponents}
                {...others} />)}
              </Form>
            );
          }}
        </Formik>
      );
}

type SectionTabProps={
  formuiSpec:any;
  formvariants:any;
  setFormuiSpec:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  handleUpFieldButton:any;
  handleDownFieldButton:any;
  formcomponents:any;
  handleRemoveField:any;
  designvalidate:any;
  fieldvalue:any;
  handleChangetabfield:any;
  handleChangeFormSection:any;
  setfieldValue:any;
  formsectionvalue:any;
  handleAddField:any;
  deleteform:any
}

type ConfirmdeleteDisalogProps={
  id:string;
  deleteform:any;
  type:string
}
function ConfirmdeleteDisalog(props:ConfirmdeleteDisalogProps){
  const [open, setOpen] = React.useState(false);
  const {id,deleteform,type}=props
  return (
    <>
    <br/>
  <ProjectDelete
    id={"delete"+id}
    type="button"
    isSubmitting={false}
    text={"Delete  " + type }
    onButtonClick={() => setOpen(true)}
    /><br/><br/>
    <Dialog
    open={open}
    onClose={() => setOpen(false)}
    aria-labelledby="alert-dialog-title"
    aria-describedby="alert-dialog-description"
  >
    <DialogTitle id="alert-dialog-title">
      {"Confirm Delete"}
    </DialogTitle>
    <DialogContent>
      <DialogContentText id="alert-dialog-description">
        Are you sure you want to delete this {type} ?
        {type==='FORM' && ' Delete form might affect others if there is connection, please make sure the field has been delelted. '} 
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      <Button 
      onClick={() => {setOpen(false); deleteform(id,type)}}
      color='primary'
      variant="contained"
       autoFocus>
        Confirm
      </Button>
    </DialogActions>
  </Dialog>
  </>)
}
function SectionTab(props:SectionTabProps){
    const theme = useTheme();
    const classes = useStyles(theme);
    const {
        fieldvalue,
        handleChangetabfield,
        handleChangeFormSection,
        formuiview,
        formvariants,
        formcomponents,
        setfieldValue,
        formsectionvalue,
        handleAddField,
        deleteform,
        ...others}= props
    // const [fieldvalue,setFieldValue]=useState(0)
    const handleSubmitFormSection = () => {console.log('section submit')}
    const [isAddField,setIsAddField]=useState(true)
    const handleAddFieldButton = () => {
      setIsAddField(true);
    };
    const handleCloseFieldButton = () => {
      setIsAddField(false);
    };
    
    return (
        <Grid container>
        <Grid item sm={2} xs={12} className={classes.settingtab}>
          <TabTab
            tabs={['Info', 'Component']}
            value={fieldvalue}
            handleChange={handleChangetabfield}
            tab_id="fieldtab"
          />
        </Grid>
        <Grid item sm={10} xs={12}>
          <TabPanel value={fieldvalue} index={0} tabname="fieldtab">
            <FormForm
              currentView="start-view"
              handleChangeForm={handleChangeFormSection}
              handleSubmit={handleSubmitFormSection}
              uiSpec={getprojectform(props.projectvalue, 'section', {
                sectionname: formuiview,
              })}
            />
            <br />
            <AutocompleteForm
              id={formuiview}
              options={getacessoption(
                props.projectvalue['access']['access' + formvariants] ?? [
                  'admin',
                ]
              )}
              labels={props.projectvalue['access']['access' + formuiview]}
              handleAutocomplete={props.handleAutocomplete}
              type={'form'}
              uiSpec={getprojectform(props.projectvalue, 'sectionaccess', {
                sectionname: formuiview,
              })}
              currentView="start-view"
              access={props.projectvalue['access']['access' + formvariants]}
              // projectvalue={projectvalue}
              // setProjectValue={props.setProjectValue}
              handlerChanges={handleChangeFormSection}
            />
            <ConfirmdeleteDisalog 
            id={formuiview}
            deleteform={deleteform}
            type={'SECTION'}
            />
            <ProjectSubmit
              id="gotonext_info"
              type="button"
              isSubmitting={false}
              text="Go To Next"
              onButtonClick={() => setfieldValue(1)}
            />
          </TabPanel>
          <TabPanel value={fieldvalue} index={1} tabname="fieldtab">
            <Alert severity="info">
              Select each new component, they will be automatically layout in
              the interface, then config each of them
            </Alert>

            {fieldvalue === 1 &&
            formuiview !== '' &&
            formcomponents[formuiview].length > 0
              ? <SectionComponents 
              formuiview={formuiview}
              formvariants={formvariants} 
              formcomponents={formcomponents}
              {...others} />
              : ''}
            <AddButton
              id="AddField"
              onButtonClick={handleAddFieldButton}
              text="ADD"
            />
            {isAddField ? (
              <Paper>
                <Grid container className={classes.addfield}>
                  <Grid item sm={11} xs={11}>
                    <FieldsListCard cretenefield={handleAddField} />
                  </Grid>
                  <Grid item sm={1} xs={1} className={classes.newfield_button}>
                    <CloseButton
                      id="ColseAddField"
                      onButtonClick={handleCloseFieldButton}
                      text="X"
                    />
                  </Grid>
                </Grid>
              </Paper>
            ) : (
              ''
            )}
          </TabPanel>
        </Grid>
      </Grid>
    )
}

type FormTabProps={
  formuiSpec:any;
  formvariants:any;
  setFormuiSpec:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  handleUpFieldButton:any;
  handleDownFieldButton:any;
  formcomponents:any;
  handleRemoveField:any;
  designvalidate:any;
  fieldvalue:any;
  handleChangetabfield:any;
  handleChangeFormSection:any;
  isAddField:any;
  setfieldValue:any;
  formsectionvalue:any;
  handleAddField:any;
  formvalue:any;
  handleChangeformvalueTab:any;
  handleChangeFormAction:any;
  setformvalue:any;
  gotonext:any;
  sectiontabs:any;
  handelonChangeSection:any;
  handelonChangeLabelSection:any;
  setProjectValue:any;
  deleteform:any;
}

type SectionTabsProps={
  formuiSpec:any;
  formvariants:any;
  setFormuiSpec:any;
  formuiview:any;
  initialValues:any;
  setinitialValues:any;
  projectvalue:any;
  handleAutocomplete:any;
  handleUpFieldButton:any;
  handleDownFieldButton:any;
  formcomponents:any;
  handleRemoveField:any;
  designvalidate:any;
  fieldvalue:any;
  handleChangetabfield:any;
  handleChangeFormSection:any;
  setfieldValue:any;
  formsectionvalue:any;
  handleAddField:any;
  deleteform:any;
  sectiontabs:any;
  handelonChangeSection:any;
  handelonChangeLabelSection:any;
}

function SectionTabs(props:SectionTabsProps){
  // const [formsectionvalue,setformsectionvalue]=useState(0)
  const {
    sectiontabs,
    formsectionvalue,
    handelonChangeSection,
    handelonChangeLabelSection,
    formvariants,
    ...others}= props

  return(
    <>
  <TabEditable
    tabs={sectiontabs}
    value={formsectionvalue}
    handleChange={handelonChangeSection}
    tab_id="sectiontab"
    handelonChangeLabel={handelonChangeLabelSection}
    tabmaxindex={props.formuiSpec['viewsets'][formvariants]['views'].length>0?props.formuiSpec['viewsets'][formvariants]['views'][props.formuiSpec['viewsets'][formvariants]['views'].length-1].replace(formvariants+'SECTION',''):0}
  />
  {props.formuiSpec['viewsets'][formvariants]['views'].map((sectiontab: string, index: number) => 
  props.formuiSpec['views'][sectiontab]['isdeleted']!==true&&(
    <TabPanel
      value={formsectionvalue}
      index={index}
      tabname="sectiontab"
      key={'sectiontab' + index}
    >
      <SectionTab 
      formvariants={formvariants}
      formsectionvalue={formsectionvalue}
      {...others} />
    </TabPanel>
  ))}
  </>
  )
}


function LiveFormTab (props:FormTabProps){
    const {
        formvariants,
        formvalue,
        handleChangeformvalueTab,
        handleAutocomplete,
        handleChangeFormAction,
        setformvalue,
        gotonext,
        fieldvalue,
        deleteform,
        ...others}= props
    const handleSubmitFormAction = () =>{

    }

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

