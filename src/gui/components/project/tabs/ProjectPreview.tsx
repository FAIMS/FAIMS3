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
 * Filename: ProjectDesign.tsx
 * Description:This is the file about form design, all uiSpec related sould be defined here
 *   TODO: [BUG] when form tab changes, section tab should be reset(Should use tabPanels instead??)
 *   TODO: [BUG] edit Project is not working, can't read information for project
 *   TODO: swith the form component, need to change to drag element
 *   TODO: [BUG] Validationschma
 *   TODO: [BUG] uiSpec ini setup issue for creating new notebook, and formcomponent issue for edit existing project
 */
import React from 'react';
import {useState, useEffect} from 'react';
import makeStyles from '@mui/styles/makeStyles';
import {
  Grid,
  Step,
  Stepper,
  StepButton,
  MobileStepper,
  Button,
  Box,
} from '@mui/material';
import {Formik, Form} from 'formik';
import {getComponentFromField, FormForm} from '../FormElement';
import {TabTab} from './TabTab';
import TabPanel from './TabPanel';
import {getprojectform, uiSpecType} from '../data/ComponentSetting';
import {ProjevtValueList, FAIMShandlerType} from '../../../../datamodel/ui';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
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
  steepscorller: {
    overflowY: 'auto',
    with: '100%',
    flexGrow: 1,
  },
}));

type ProjectPreviewProps = {
  project_id: string | null;
  formuiSpec: uiSpecType;
  setFormuiSpec: FAIMShandlerType;
  handleSaveUiSpec: FAIMShandlerType;
  accessgroup: Array<string>;
  projectvalue: ProjevtValueList;
  setProjectValue: FAIMShandlerType;
};
type formcomponents = any;

export default function ProjectPreviewTab(props: ProjectPreviewProps) {
  // if(props.project_id===undefined) console.log('New Project'+props.project_id)

  const theme = useTheme();
  const classes = useStyles(theme);
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const {
    project_id,
    formuiSpec,
    setFormuiSpec,
    accessgroup,
    projectvalue,
    ...others
  } = props;
  const ini = {_id: project_id ?? 'new_notbook'};

  const [formtabs, setformTabs] = useState<Array<string>>([]);
  const [formlabel, setformlabel] = useState<string>('');
  const [formvariants, setFormVariants] = useState<string>(
    formuiSpec['visible_types'][0]
  );
  const [fieldNames, setfieldNames] = useState<Array<string>>([]);
  const [initialValues, setinitialValues] = useState({});
  const [role, setrole] = useState('admin');
  const [view_name, setView] = useState('SECTION1');
  const [activeStep, setActiveStep] = React.useState(0);

  useEffect(() => {
    setinit();
  }, []);

  useEffect(() => {
    setinit();
  }, [view_name]);

  const getfieldNames = (fieldNames: Array<string>, rolename: string) => {
    const newfields = fieldNames.filter(
      (fielName: string) =>
        formuiSpec['fields'][fielName]['access'].includes(rolename) === true
    );
    console.log(newfields);
    return newfields;
  };

  const setinit = () => {
    setformTabs(
      formuiSpec['visible_types'].map(
        (tab: string) => (tab = formuiSpec['viewsets'][tab]['label'] ?? tab)
      )
    );
    setformlabel(formtabs[0]);
    setformlabel(formuiSpec['visible_types'][0]);
    setfieldNames(formuiSpec['views'][formvariants + view_name]['fields']);
  };

  const handleChangeForm = (event: any) => {};

  const handleChangeFormRole = (event: any) => {
    console.log(event.target.name + event.target.value);
    setrole(event.target.value);
    console.log(event.target.value);
    const newfields = getfieldNames(
      formuiSpec['views'][formvariants + view_name]['fields'],
      event.target.value
    );
    setfieldNames(newfields);
    return true;
  };

  const handleSubmitForm = (values: any) => {};

  const handelonChangeVariants = (event: any, index: number) => {
    const id = formuiSpec['visible_types'][index];
    setFormVariants(id);
    let newfields = [];
    try {
      newfields = formuiSpec['views'][id + 'SECTION1']['fields'];
    } catch (error) {
      console.debug('No fields');
    }
    setfieldNames(newfields);
    setformlabel(formtabs[index]);
    console.log(fieldNames);
  };

  return (
    <>
      <TabTab
        tabs={formtabs}
        value={
          formtabs.indexOf(formlabel) > 0 ? formtabs.indexOf(formlabel) : 0
        }
        handleChange={handelonChangeVariants}
        tab_id="projectreview"
      />
      {formtabs.map((tab: string, index: number) => (
        <TabPanel
          value={
            formtabs.indexOf(formlabel) > 0 ? formtabs.indexOf(formlabel) : 0
          }
          index={index}
          tabname="projectreview"
        >
          <Grid container>
            <Grid item sm={3} xs={12}>
              <FormForm
                currentView={'start-view'}
                handleChangeForm={handleChangeFormRole}
                handleSubmit={handleSubmitForm}
                uiSpec={getprojectform(projectvalue, 'preview', {
                  forms: [formvariants],
                })}
              />
            </Grid>
            <Grid item sm={1} xs={12}></Grid>
            <Grid item sm={8} xs={12} className={classes.steepscorller} style={{overflow:'hidden'}}>
              {not_xs ? (
                <Stepper
                  nonLinear
                  activeStep={formuiSpec.viewsets[formvariants].views.indexOf(
                    formvariants + view_name
                  )}
                  alternativeLabel
                  
                >
                  {formuiSpec.viewsets[formvariants].views.map(
                    (view_name: string) => (
                      <Step key={view_name}>
                        <StepButton
                          onClick={() => {
                            setView(view_name.replace(formvariants, ''));
                          }}
                        >
                          {formuiSpec.views[view_name].label}
                        </StepButton>
                      </Step>
                    )
                  )}
                </Stepper>
              ) : (
                <Box>
                  <MobileStepper
                    variant="text"
                    steps={formuiSpec.viewsets[formvariants].views.length}
                    position="static"
                    activeStep={activeStep}
                    nextButton={
                      <Button
                        size="small"
                        onClick={() => {
                          const stepnum = activeStep + 1;
                          setActiveStep(stepnum);

                          formuiSpec.viewsets[formvariants].views[
                            stepnum
                          ].replace(formvariants, '');
                        }}
                        disabled={
                          activeStep ===
                          formuiSpec.viewsets[formvariants].views.length - 1
                        }
                      >
                        Next
                        {theme.direction === 'rtl' ? (
                          <KeyboardArrowLeft />
                        ) : (
                          <KeyboardArrowRight />
                        )}
                      </Button>
                    }
                    backButton={
                      <Button
                        size="small"
                        onClick={() => {
                          const stepnum = activeStep - 1;
                          setActiveStep(stepnum);
                          setView(
                            formuiSpec.viewsets[formvariants].views[
                              stepnum
                            ].replace(formvariants, '')
                          );
                        }}
                        disabled={activeStep === 0}
                      >
                        {theme.direction === 'rtl' ? (
                          <KeyboardArrowRight />
                        ) : (
                          <KeyboardArrowLeft />
                        )}
                        Back
                      </Button>
                    }
                  />
                </Box>
              )}
              {fieldNames.length > 0 ? (
                <Formik
                  key={index}
                  initialValues={initialValues}
                  validateOnMount={true}
                  onSubmit={(values, {setSubmitting}) => {
                    setTimeout(() => {
                      setSubmitting(false);
                      handleSubmitForm(values);
                    }, 500);
                  }}
                >
                  {formProps => {
                    return (
                      <Form>
                        {fieldNames.map((fieldName: string) =>
                          getComponentFromField(
                            formuiSpec,
                            fieldName,
                            formProps,
                            handleChangeForm
                          )
                        )}
                      </Form>
                    );
                  }}
                </Formik>
              ) : (
                'No Form component yet,click the GO TO DESIGN FORM button to design Form and add component before Preview'
              )}
            </Grid>
          </Grid>
        </TabPanel>
      ))}
    </>
  );
}
