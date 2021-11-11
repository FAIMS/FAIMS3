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
 * Filename: CreateProjectCard.tsx
 * Description: No autosync in Notebook creation/edit in this Stage
 *   TODO: seperate the tabs to different files
 *   TODO: edit Project is not working, can't read information for project
 *   TODO: setup project information
 *     TODO:  preview, User, Behaviour, submit
 *   TODO: swith the form component, need to change to drag element
 *   TODO: sync into and save to DB(??)
 */
import React from 'react';
import {useState, useEffect} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Grid, AppBar, Box} from '@material-ui/core';
import {TabTab} from './tabs/TabTab';
import TabPanel from './tabs/TabPanel';
import ProjectDesignTab from './tabs/ProjectDesign';
import ProjectInfoTab from './tabs/ProjectInfo';
import ProjectSubmitTab from './tabs/ProjectSubmit';
import ProjectUserTab from './tabs/ProjectUser';
import ProjectPreviewTab from './tabs/ProjectPreview';
import ProjectBehaviourTab from './tabs/ProjectBehaviour';
import ProjectOverviewTab from './tabs/ProjctOverview'
import {ProjectSubmit} from './tabs/ProjectButton';
import {
  setProjectInitialValues,
  uiSpecType,
  getprojectform,
} from './data/ComponentSetting';
import {ProjevtValueList} from '../../../datamodel/ui';
import {ProjectUIFields} from '../../../datamodel/typesystem';
import {add_autoincrement_reference_for_project} from '../../../datamodel/autoincrement';
import {setUiSpecForProject} from '../../../uiSpecification';
import {metadata_dbs} from '../../../sync/databases';
import {ProjectUIModel, ProjectInformation} from '../../../datamodel/ui';
import {create_new_project_dbs} from '../../../sync/new-project';
import {setProjectMetadata, getProjectMetadata} from '../../../projectMetadata';
import grey from '@material-ui/core/colors/grey';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {Formik, Form} from 'formik';
import {getValidationSchemaForViewset} from '../../../data_storage/validation';

/* eslint-disable @typescript-eslint/no-unused-vars */

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },
}));

type CreateProjectCardProps = {
  project_id: string | null;
  uiSpec: uiSpecType | null;
  project_info: ProjectInformation | null;
};

const accessgroup = ['moderator', 'admin', 'team'];

const sections_default = ['SECTION1'];
const variant_default = ['FORM1'];
const projecttabs = [
  'Info',
  'Design',
  'Overview',
  'Preview',
  'Behaviour',
  'Submit',
];
const variant_label = 'Form1';
const ini_projectvalue = {
  accesses: accessgroup,
  forms: {
    FORM1: {
      submitActionFORM1: 'Save and New',
      annotationFORM1: true,
      uncertaintyFORM1: false,
    },
  },
  sections: {},
  access: {},
  ispublic: false,
  isrequest: false,
  errors: {is_valid: true},
  meta: {},
  project_lead: '',
  lead_institution: '',
  behavious: {},
};

const PROJECT_META = [
  'accesses',
  'forms',
  'sections',
  'meta',
  'access',
  'ispublic',
  'isrequest',
  'behavious',
  'project_lead',
  'lead_institution',
];

export default function CreateProjectCard(props: CreateProjectCardProps) {
  const theme = useTheme();
  const classes = useStyles(theme);
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const [project_id, setProjectID] = useState(props.project_id);
  const ini = {_id: props.project_id};
  const [projectvalue, setProjectValue] = useState<ProjevtValueList>({
    ...ini_projectvalue,
    project_id: props.project_id,
  });
  const [initialValues, setinitialValues] = useState<ProjectUIFields>(ini);
  const [projectuiSpec, setProjectuiSpec] = useState<Array<any>>();
  const [projecttabvalue, setProjecttabvalue] = useState(0);
  const [formuiSpec, setFormuiSpec] = useState<ProjectUIModel>({
    fields: {},
    views: {},
    viewsets: {},
    visible_types: [],
  });
  const [formtabs, setformTabs] = useState<Array<string>>([]);
  const [error, setError] = useState(null as null | {});
  const [validationSchema, setvalidationSchema] = useState(
    getValidationSchemaForViewset(
      getprojectform(projectvalue, 'project'),
      'project'
    )
  );

  useEffect(() => {
    setinit();
    setProjectID(props.project_id);
    console.debug('change project_id' + props.project_id);
  }, [props.project_id]);

  useEffect(() => {
    if (props.uiSpec !== null) {
      setFormuiSpec(props.uiSpec);
      console.debug('change project_ui for edit');
    } else {
      setinit();
      console.debug('change project_ui for add');
    }
  }, [props.uiSpec]);

  useEffect(() => {
    if (props.project_info !== undefined && props.uiSpec !== null) {
      console.log('get project value');

      const projectui = getprojectform(projectvalue, 'project');
      const ini = {
        ...setProjectInitialValues(projectui, 'start-view', {_id: project_id}),
        ...{...projectvalue, ...props.project_info},
      };
      setinitialValues({...ini});
      setProjectValue({...projectvalue, ...props.project_info});
      setProjecttabvalue(0);
      setinitialValues({...ini});
      setvalidationSchema(getValidationSchemaForViewset(projectui, 'project'));
      console.log(projectvalue);
      console.log(ini);
      console.log(initialValues);
    } else
      setProjectValue({
        ...ini_projectvalue,
        project_id: props.project_id,
      });
  }, [props.project_info]);

  const setinifornewproject = () => {
    //if create new notebook then set an empty formUI
    setProjectID(props.project_id);
    const view = variant_default[0] + sections_default[0];
    const formview = formuiSpec;
    formview['fields'] = {};
    formview['views'] = {};
    formview['viewsets'] = {};
    const fields: string[] = [];
    formview['views'][view] = {
      fields: fields,
      uidesign: 'form',
      label: sections_default[0],
    };
    formview['viewsets'] = {FORM1: {views: [view], label: variant_label}};

    setProjectValue({...ini_projectvalue, project_id: null});
    const projectui = getprojectform(
      {...ini_projectvalue, project_id: props.project_id},
      'project'
    );
    console.log(projectui);
    const inivalue = setProjectInitialValues(projectui, 'start-view', {
      _id: props.project_id,
    });
    setinitialValues({...inivalue});
    setFormuiSpec({
      fields: formview.fields,
      views: formview.views,
      viewsets: formview.viewsets,
      visible_types: variant_default,
    });
    setinitialValues({...inivalue});
    setvalidationSchema(getValidationSchemaForViewset(projectui, 'project'));
  };

  const setinit = () => {
    if (props.project_id === null || props.project_id === undefined) {
      //if create new notebook then set an empty formUI
      console.debug('setup' + props.project_id + '---START');
      setinifornewproject();
      console.log(project_id);
      console.log(initialValues);
      console.log(projectvalue);
    }

    if (props.project_id !== null && projectvalue.name !== '') {
      //for edit project
      const projectui = getprojectform(projectvalue, 'project');
      setinitialValues(
        setProjectInitialValues(projectui, 'start-view', {_id: project_id})
      );
      setvalidationSchema(getValidationSchemaForViewset(projectui, 'project'));
      console.log(
        setProjectInitialValues(
          getprojectform(projectvalue, 'project'),
          'start-view',
          {_id: project_id}
        )
      );
      console.log(initialValues);
      getprojectmeta();
    }

    setProjecttabvalue(0);
  };

  const get_autoincrement = () => {
    const autoincrement_array: Array<any> = [];
    for (const [key, value] of Object.entries(formuiSpec['fields'])) {
      if (value['component-name'] === 'BasicAutoIncrementer') {
        autoincrement_array.push({
          project_id: project_id,
          form_id: value['component-parameters']['form_id'],
          field_id: key,
        });
      }
    }
    return autoincrement_array;
  };

  const add_autoince_refereence = async (autoince: any) => {
    if (project_id !== null) {
      try {
        await add_autoincrement_reference_for_project(
          project_id,
          autoince.form_id,
          autoince.field_id
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  const saveformuiSpec = async (res: any = undefined) => {
    try {
      console.log(
        await setUiSpecForProject(
          metadata_dbs[res ?? project_id].local,
          formuiSpec
        )
      );

      const autoincrecs = get_autoincrement();
      autoincrecs.map((autoince: any) => add_autoince_refereence(autoince));

      console.log('databases updated...' + res + project_id);
    } catch (err) {
      console.error(
        'databases needs cleaning value not saved...' + res + project_id
      );
      console.debug(err);
    }
  };

  const getprojectmeta = async () => {
    try {
      try {
        if (project_id !== null) {
          getProjectMetadata(project_id, 'projectvalue')
            .then(res => {
              setProjectValue({...projectvalue, ...res});
              const projectui = getprojectform(projectvalue, 'project');
              setinitialValues(
                setProjectInitialValues(projectui, 'start-view', {
                  _id: project_id,
                })
              );
              console.log(initialValues);
            })
            .catch(error => {
              console.error('Not get meta data', error);
            });
        }
      } catch (error) {
        console.error('DO not get the meta data...');
        console.debug(error);
      }
    } catch (err) {
      console.error('databases not created...');
      console.log(err);
    }
  };

  const updateproject = async (values: any, fieldlist: Array<string>) => {
    try {
      const pvlues: any = {projectvalue: {}};

      PROJECT_META.map(
        (field: string) => (pvlues.projectvalue[field] = projectvalue[field])
      );

      for (const key of fieldlist) {
        //save for meta data for project
        try {
          if (project_id !== null)
            await setProjectMetadata(project_id, key, values[key]);
          console.log(key+values[key])
        } catch (err) {
          console.error('databases needs cleaning for update error...');
          console.debug(err);
        }
      }

      // for (const key in values) {
      //   if (PROJECT_META.includes(key)) {
      //     //TODO: check if name can editable or not
      //     pvlues.projectvalue[key]=values[key]
      //     try {
      //       if(project_id!==null)
      //         console.log(await setProjectMetadata(project_id, key,values[key] ));
      //     } catch (err) {
      //       console.error('databases needs cleaning for update error...');
      //       console.debug(err);
      //     }
      //   }
      //   //save attachement data??
      //   //else if()
      // }
      //save meta data
      try {
        if (project_id !== null)
          console.log(
            await setProjectMetadata(
              project_id,
              'projectvalue',
              pvlues.projectvalue
            )
          );
      } catch (err) {
        console.error('databases needs cleaning for update error...');
        console.debug(err);
      }
    } catch (err) {
      console.error('databases not created...');
      console.log(err);
    }
  };

  const handleChangetab = (event: any, index: number) => {
    setProjecttabvalue(index);
  };

  const handleChangeFormProject = (event: any) => {
    const newproject = projectvalue;
    newproject[event.target.name] = event.target.value;
    setProjectValue(newproject);
  };

  const submithandlerProject = (values: any) => {
    //this function is to save project information
    //TODO currently just save for projectname so added getnewdb function here, need to update it
    // if (project_id === undefined) {
    //   getnewdb();
    // } else {
    //   updateproject(values);
    // }
  };

  const handleSaveUiSpec = () => {
    if (
      project_id !== '' &&
      project_id !== null &&
      Object.keys(formuiSpec['fields']).length !== 0
    ) {
      saveformuiSpec();
    }
  };

  const handlerprojectsubmit_pounch = async () => {
    //save into local pounch

    if (project_id === null) {
      await create_new_project_dbs(projectvalue.name).then(res => {
        console.log('projectid' + res);
        if (res !== '' && res !== null) {
          setProjectID(res);
          setProjectValue({...projectvalue, project_id: res});
        }

        if (
          res !== '' &&
          res !== null &&
          Object.keys(formuiSpec['fields']).length !== 0
        ) {
          saveformuiSpec(res);
        }
      });
    }

    if (
      project_id !== '' &&
      project_id !== null &&
      Object.keys(formuiSpec['fields']).length !== 0
    ) {
      saveformuiSpec();
    }
    try {
      updateproject(projectvalue, PROJECT_META);
    } catch {
      console.error('not saved meta data');
    }
  };

  const handlerprojectsubmit_counch = () => {
    //if project online save it
    //else if project local, submit request in Beta

    try {
      updateproject({...projectvalue,isrequest:true}, ['isrequest']);
    } catch {
      console.error('not saved meta data');
    }
    alert('Request Send!');
  };

  const handleSubmit = (values: any) => {};

  const isready = () => {
    // return !(initialValues['name']===''&&project_id!==null)
    if (initialValues['name'] !== '' && props.project_id !== null) return true; //for edit project
    if (props.project_id === null && initialValues['name'] === '') return true; //for new project, create new project
    return false;
  };

  return (
    <div className={classes.root}>
      <AppBar position="static" color="primary">
        <TabTab
          not_xs={not_xs}
          tabs={projecttabs}
          value={projecttabvalue}
          handleChange={handleChangetab}
          tab_id="primarytab"
        />
      </AppBar>
      <Grid container>
        {isready() && (
          <Grid item sm={12} xs={12}>
            <Formik
              initialValues={initialValues}
              validateOnMount={true}
              validationSchema={validationSchema}
              onSubmit={(values, {setSubmitting}) => {
                setTimeout(() => {
                  setSubmitting(false);
                  handleSubmit(values);
                }, 500);
              }}
            >
              {formProps => {
                return (
                  <Form>
                    <TabPanel
                      value={projecttabvalue}
                      index={0}
                      tabname="primarytab"
                    >
                      {projecttabvalue === 0 ? (
                        <ProjectInfoTab
                          project_id={project_id}
                          projectvalue={projectvalue}
                          setProjectValue={setProjectValue}
                          handleChangeFormProject={handleChangeFormProject}
                          setProjecttabvalue={setProjecttabvalue}
                          formProps={formProps}
                        />
                      ) : (
                        ''
                      )}
                    </TabPanel>
                    <TabPanel
                        value={projecttabvalue}
                        index={4}
                        tabname="primarytab"
                      >
                        <ProjectBehaviourTab
                          project_id={project_id}
                          projectvalue={projectvalue}
                          setProjectValue={setProjectValue}
                          formProps={formProps}
                        />
                        <ProjectSubmit
                          id="gotonextbehaviour"
                          type="submit"
                          isSubmitting={false}
                          text="Go To Next"
                          onButtonClick={() => setProjecttabvalue(6)}
                        />
                      </TabPanel>
                      <TabPanel
                        value={projecttabvalue}
                        index={5}
                        tabname="primarytab"
                      >
                        <ProjectSubmitTab
                          project_id={project_id}
                          projectvalue={projectvalue}
                          setProjectValue={setProjectValue}
                          handleSubmit={handlerprojectsubmit_pounch}
                          handlepublish={handlerprojectsubmit_counch}
                          formProps={formProps}
                          formuiSpec={formuiSpec}
                        />
                      </TabPanel>
                    </Form>
                  );
                }}
              </Formik>
              <TabPanel value={projecttabvalue} index={1} tabname="primarytab">
                {projecttabvalue === 1 ? (
                  <ProjectDesignTab
                    project_id={project_id}
                    accessgroup={projectvalue.accesses}
                    projectvalue={projectvalue}
                    setProjectValue={setProjectValue}
                    formuiSpec={formuiSpec}
                    setFormuiSpec={setFormuiSpec}
                    handleSaveUiSpec={handleSaveUiSpec}
                    setProjecttabvalue={setProjecttabvalue}
                  />
                ) : (
                  ''
                )}
              </TabPanel>
              <TabPanel value={projecttabvalue} index={2} tabname="primarytab">
                <>
                  <Alert severity="info">
                    High level view of Notebook showing relationships between
                    forms. To modify a relationship, go to the Design Tab
                  </Alert>
                  <ProjectOverviewTab 
                  project_id={project_id}
                  projectvalue={projectvalue}
                  setProjectValue={setProjectValue}
                  formuiSpec={formuiSpec}
                  />
                  <ProjectSubmit
                    id="gotonextoverview"
                    type="submit"
                    isSubmitting={false}
                    text="Go To Next"
                    onButtonClick={() => setProjecttabvalue(3)}
                  />
                </>
              </TabPanel>
              <TabPanel value={projecttabvalue} index={3} tabname="primarytab">
                  <>
                    <Alert severity="info">
                      Select the user role to preview the notebook as a user with
                      that role
                    </Alert>
                    <ProjectPreviewTab
                      project_id={project_id}
                      accessgroup={projectvalue.accesses}
                      projectvalue={projectvalue}
                      setProjectValue={setProjectValue}
                      formuiSpec={formuiSpec}
                      setFormuiSpec={setFormuiSpec}
                      handleSaveUiSpec={handleSaveUiSpec}
                    />
                    <ProjectSubmit
                      id="sendbacktodesign"
                      type="submit"
                      isSubmitting={false}
                      text="GO to Design Form"
                      onButtonClick={() => setProjecttabvalue(1)}
                    />
  
                    <ProjectSubmit
                      id="gotonextperview"
                      type="submit"
                      isSubmitting={false}
                      text="Go To Next"
                      onButtonClick={() => setProjecttabvalue(4)}
                    />
                  </>
               
              </TabPanel>

          </Grid>
        )}

        <Grid item sm={4} xs={12}>
          <Box bgcolor={grey[200]} pl={2} pr={2} style={{overflowX: 'scroll'}}>
            <pre>{JSON.stringify(projectvalue, null, 2)}</pre>
            <pre>{JSON.stringify(formuiSpec, null, 2)}</pre>
          </Box>
        </Grid>
      </Grid>
    </div>
  );
}
