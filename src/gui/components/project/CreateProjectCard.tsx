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
 * Filename: CreateProjectCard.tsx
 * Description: No autosync in Notebook creation/edit in this Stage
 *   TODO: edit Project is not working, can't read information for project
 *   TODO: setup project information
 *     TODO:  preview, User, Behaviour, submit
 *   TODO: switch the form component, need to change to drag element
 *   TODO: sync into and save to DB(??)
 */
import React from 'react';
import {useState, useEffect} from 'react';

import {Formik, Form} from 'formik';

import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import makeStyles from '@mui/styles/makeStyles';
import {Grid, AppBar, Box} from '@mui/material';
import {TabTab} from './tabs/TabTab';

import TabPanel from './tabs/TabPanel';
import ProjectDesignTab from './tabs/ProjectDesign';
import ProjectInfoTab from './tabs/ProjectInfo';
import ProjectSubmitTab from './tabs/ProjectSubmit';
import ProjectPreviewTab from './tabs/ProjectPreview';
import ProjectBehaviourTab from './tabs/ProjectBehaviour';
import ProjectOverviewTab from './tabs/ProjectOverview';
import {ProjectSubmit} from './tabs/ProjectButton';
import {
  setProjectInitialValues,
  uiSpecType,
  getprojectform,
} from './data/ComponentSetting';
import {ProjectValueList} from '../../../datamodel/ui';

import {ProjectUIFields} from '../../../datamodel/typesystem';
import {add_autoincrement_reference_for_project} from '../../../datamodel/autoincrement';
import {setUiSpecForProject} from '../../../uiSpecification';
import {ProjectUIModel, ProjectInformation} from '../../../datamodel/ui';
import {create_new_project_dbs} from '../../../sync/new-project';
import {
  setProjectMetadata,
  getProjectMetadata,
  setProjectMetadataFiles,
} from '../../../projectMetadata';
import {getValidationSchemaForViewset} from '../../../data_storage/validation';
import {HRID_STRING} from '../../../datamodel/core';
import {grey} from '@mui/material/colors';
import {getid} from './data/ComponentSetting';
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

const accessgroup = ['admin', 'moderator', 'team'];

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
  project_status: 'draft',
  accesses: accessgroup,
  forms: {
    FORM1: {
      submitActionFORM1: 'Save and New',
      annotationFORM1: true,
      uncertaintyFORM1: false,
      formaccessinheritFORM1: false,
      visibleFORM1: true,
    },
  },
  sections: {},
  access: {
    accessFORM1: ['admin'],
  },
  ispublic: false,
  isrequest: false,
  errors: {is_valid: true},
  meta: {},
  project_lead: '',
  lead_institution: '',
  behaviours: {},
  filenames: [],
};

const PROJECT_META = [
  'project_status',
  'accesses',
  'forms',
  'sections',
  'meta',
  'access',
  'ispublic',
  'isrequest',
  'behaviours',
  'project_lead',
  'lead_institution',
  'pre_description',
  'filenames',
];

export default function CreateProjectCard(props: CreateProjectCardProps) {
  const theme = useTheme();
  const classes = useStyles(theme);
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const [project_id, setProjectID] = useState(props.project_id);
  const ini = {_id: props.project_id};
  const [projectvalue, setProjectValue] = useState<ProjectValueList>({
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
  const [project_info, set_project_info] = useState(
    null as null | ProjectInformation
  );
  const [validationSchema, setvalidationSchema] = useState(
    getValidationSchemaForViewset(
      getprojectform(projectvalue, 'project'),
      'project'
    )
  );

  useEffect(() => {
    let isactive = true;
    // cleanup toggles value,
    if (isactive) {
      setinit();
      setProjectID(props.project_id);
    }
    return () => {
      isactive = false;
    };
  }, [props.project_id]);

  useEffect(() => {
    let isactive = true;
    // cleanup toggles value,
    if (isactive) {
      if (props.uiSpec !== null) {
        setFormuiSpec(props.uiSpec);
        console.debug('change project_ui for edit');
      } else {
        setinit();
        console.debug('change project_ui for add');
      }
    }
    return () => {
      isactive = false;
    };
  }, [props.uiSpec]);

  useEffect(() => {
    let isactive = true;
    // cleanup toggles value,
    if (isactive) {
      if (props.project_info !== undefined && props.uiSpec !== null) {
        resetprojectvalue(props.project_info);
      } else
        setProjectValue({
          ...ini_projectvalue,
          project_id: props.project_id,
        });
      console.log('initialValues', initialValues);
    }
    return () => {
      isactive = false;
    };
  }, [props.project_info]);

  useEffect(() => {
    let isactive = true;
    // cleanup toggles value,
    if (isactive) {
      if (
        project_id !== null &&
        project_id !== null &&
        project_id !== undefined &&
        projectvalue.pre_description !== undefined &&
        projectvalue.pre_description !== ''
      ) {
        //this is the function to solve the issue for new record button not be displayed, need to update in the future---Kate
        handlerprojectsubmit_pounch();
      }
    }
    return () => {
      isactive = false;
    };
  }, [project_id]);

  const resetprojectvalue = (newvalue: any) => {
    const projectui = getprojectform(projectvalue, 'project');
    const newprovalue = projectvalue;
    newprovalue['name'] = newvalue.name;
    const ini = {
      ...setProjectInitialValues(projectui, 'start-view', {_id: project_id}),
      newprovalue,
    };

    setProjectValue({...newprovalue});
    setProjecttabvalue(0);
    setinitialValues({...ini});
    setvalidationSchema(getValidationSchemaForViewset(projectui, 'project'));
  };

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
    console.log('projectui', projectui);
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

  const setinit = async () => {
    if (props.project_id === null || props.project_id === undefined) {
      //if create new notebook then set an empty formUI
      setinifornewproject();
    }

    if (props.project_id !== null && projectvalue.name !== '') {
      //for edit project
      const projectui = getprojectform(projectvalue, 'project');

      setinitialValues(
        setProjectInitialValues(projectui, 'start-view', {_id: project_id})
      );
      setvalidationSchema(getValidationSchemaForViewset(projectui, 'project'));

      await getprojectmeta();
      console.log('get_autoincrement', get_autoincrement());
    }

    setProjecttabvalue(0);
  };

  const get_autoincrement = () => {
    const form_ids: Array<string> = [];
    const field_ids: Array<string> = [];
    const labels: Array<string> = [];

    for (const [key, value] of Object.entries(formuiSpec['fields'])) {
      if (value['component-name'] === 'BasicAutoIncrementer') {
        form_ids.push(value['component-parameters']['form_id']);
        field_ids.push(key);
        labels.push(value['component-parameters']['label']);
      }
      if (value['component-name'] === 'TemplatedStringField') {
        if (key.includes(HRID_STRING)) {
          if (
            formuiSpec['fields'][value['component-parameters']['linked']] !==
              undefined &&
            value['component-parameters']['template'] !==
              formuiSpec['fields'][value['component-parameters']['linked']][
                'component-parameters'
              ]['template']
          ) {
            const fields = formuiSpec['fields'];
            fields[key]['component-parameters']['template'] =
              formuiSpec['fields'][value['component-parameters']['linked']][
                'component-parameters'
              ]['template'];
            setFormuiSpec({...formuiSpec, fields: fields});
          }
        }
      }
    }
    return {form_id: form_ids, field_id: field_ids, label: labels};
  };

  const add_autoince_reference = async (autoince: any) => {
    if (project_id !== null) {
      try {
        await add_autoincrement_reference_for_project(
          project_id,
          autoince.form_id,
          autoince.field_id,
          autoince.label
        );
      } catch (error) {
        console.error('Failed to add autoincrement reference', error);
      }
    }
  };

  const saveformuiSpec = async (res: any = undefined) => {
    try {
      await setUiSpecForProject(res ?? project_id, formuiSpec);

      const autoince = get_autoincrement();
      await add_autoince_reference(autoince);
    } catch (err) {
      console.error(
        'Failed to set UI spec and autoinc reference',
        res,
        project_id,
        err
      );
    }
  };

  const getprojectmeta = async () => {
    try {
      try {
        if (project_id !== null) {
          const res = await getProjectMetadata(project_id, 'projectvalue');
          const filenames = await getProjectMetadata(
            project_id,
            'attachfilenames'
          );
          const newvalue = {...projectvalue, ...res};
          newvalue['attachfilenames'] = filenames;
          const files: any = {};
          for (const index in newvalue['attachfilenames']) {
            const file = await getProjectMetadata(
              project_id,
              newvalue['attachfilenames'][index]
            );
            files[newvalue['attachfilenames'][index]] = file;
          }
          newvalue['files'] = files;
          setProjectValue(newvalue);
          const projectui = getprojectform(newvalue, 'project');
          setinitialValues(
            setProjectInitialValues(projectui, 'start-view', {
              _id: project_id,
            })
          );
        }
      } catch (error) {
        console.error('DO not get the meta data...', error);
      }
    } catch (err) {
      console.error('databases not created...', err);
    }
  };

  const handleattachment = (attachments: File[]) => {
    const filenames: {[key: string]: File} = {};
    if (attachments === undefined || attachments.length === 0) {
      setProjectValue({...projectvalue, newfiles: filenames});
      return filenames;
    }
    for (const index in attachments) {
      const file_id = 'Attachment-' + getid();
      filenames[file_id] = attachments[index];
    }
    setProjectValue({...projectvalue, newfiles: filenames});
    return filenames;
  };

  const saveattachement = async (projectvalue: any) => {
    try {
      if (project_id !== null && projectvalue.attachments !== undefined) {
        await setProjectMetadataFiles(
          project_id,
          'attachments',
          projectvalue.attachments
        );
        const filenames: string[] = projectvalue.attachfilenames ?? [];

        let new_filenames = projectvalue.newfiles;
        //reset the newfiles list if the attachments are not been processed
        if (
          projectvalue.newfiles === undefined ||
          Object.keys(projectvalue.newfiles).length <
            projectvalue.attachments.length
        )
          new_filenames = handleattachment(projectvalue.attachments);

        for (const [key, value] of Object.entries(new_filenames)) {
          const file_id = key;
          try {
            await setProjectMetadataFiles(project_id, file_id, [
              new_filenames[key],
            ]);
            filenames.push(file_id);
          } catch (error) {
            console.error(
              'error save attachment',
              error,
              new_filenames,
              key,
              new_filenames[key]
            );
          }
        }
        await setProjectMetadata(project_id, 'attachfilenames', filenames);
      }
    } catch (err) {
      console.error(
        'databases needs cleaning for save attachment error...',
        err
      );
    }
  };

  const updateproject = async (values: any, fieldlist: Array<string>) => {
    try {
      const prevalues: any = {projectvalue: {}};

      PROJECT_META.map(
        (field: string) => (prevalues.projectvalue[field] = projectvalue[field])
      );

      for (const key of fieldlist) {
        //save for meta data for project
        try {
          if (project_id !== null)
            await setProjectMetadata(project_id, key, values[key]);
        } catch (err) {
          console.error(
            'Failed to set project metadata',
            project_id,
            key,
            values[key],
            err
          );
        }
      }

      //save meta data
      try {
        if (project_id !== null)
          await setProjectMetadata(
            project_id,
            'projectvalue',
            prevalues.projectvalue
          );
      } catch (err) {
        console.error(
          'Failed to set project value',
          project_id,
          prevalues.projectvalue,
          err
        );
      }

      await saveattachement(projectvalue);
    } catch (err) {
      console.error('Failed to update project', project_id, err);
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

  const handleSaveUiSpec = async () => {
    if (
      project_id !== '' &&
      project_id !== null &&
      Object.keys(formuiSpec['fields']).length !== 0
    ) {
      await saveformuiSpec();
    }
  };

  const handleChangeFormProjectAttachment = () => {
    console.log('run');
  };

  const handlerprojectsubmit_pounch = async () => {
    //save into local pounch
    try {
      if (project_id === null) {
        await create_new_project_dbs(projectvalue.name).then(async res => {
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
            await saveformuiSpec(res);
          }
        });
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(project_id);
    } catch (err) {
      console.error('not saved meta data', err);
    }

    if (
      project_id !== '' &&
      project_id !== null &&
      Object.keys(formuiSpec['fields']).length !== 0
    ) {
      await saveformuiSpec();
    }
    try {
      await updateproject(projectvalue, PROJECT_META);
    } catch (err) {
      console.error('not saved meta data', err);
    }
  };

  const handlerprojectsubmit_counch = async () => {
    //if project online save it
    //else if project local, submit request in Beta

    try {
      const newvalue = projectvalue;
      newvalue['isrequest'] = true;
      newvalue['project_status'] = 'pending';
      setProjectValue({...newvalue});
      await updateproject(newvalue, ['isrequest', 'project_status']);
    } catch (err) {
      console.error('not saved meta data', err);
    }
    alert('Request Send!');
  };

  const handleSubmit = (values: any) => {
    if (values.attachments !== undefined && values.attachments.length > 0) {
      const newproject = projectvalue;
      newproject['attachments'] = values.attachments;
      newproject['filenames'] = values.attachments[0].name;
      setProjectValue({...newproject});
    }
  };

  const isready = () => {
    if (initialValues['name'] !== '' && props.project_id !== null) return true; //for edit project
    if (props.project_id === null && initialValues['name'] === '') return true; //for new project, create new project
    return false;
  };

  return (
    <div>
      <AppBar position="static" color="primary" sx={{boxShadow: 'none'}}>
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
                          handleChangeFormProjectAttachment={
                            handleChangeFormProjectAttachment
                          }
                          handleattachment={handleattachment}
                        />
                      ) : (
                        ''
                      )}
                      {/* <ProjectSubmit
                        id="gotonextbehaviour"
                        type="submit"
                        isSubmitting={false}
                        text="Save and Next"
                        onButtonClick={() => handlerprojectsubmit_pounch()}
                      /> */}
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
                        type="button"
                        isSubmitting={false}
                        text="Go To Next"
                        onButtonClick={() => setProjecttabvalue(5)}
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
                  forms. To modify a relationship, go to the Design Tab, add
                  Related field in Each Form each Section
                </Alert>
                <ProjectOverviewTab formuiSpec={formuiSpec} />
                <ProjectSubmit
                  id="gotonextoverview"
                  type="button"
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
                  type="button"
                  isSubmitting={false}
                  text="GO to Design Form"
                  onButtonClick={() => setProjecttabvalue(1)}
                />

                <ProjectSubmit
                  id="gotonextperview"
                  type="button"
                  isSubmitting={false}
                  text="Go To Next"
                  onButtonClick={() => setProjecttabvalue(4)}
                />
              </>
            </TabPanel>
          </Grid>
        )}
        {String(process.env.REACT_APP_SERVER) === 'developers' && (
          <Grid item sm={6} xs={12}>
            <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(projectvalue, null, 2)}</pre>
            </Box>
          </Grid>
        )}
        {String(process.env.REACT_APP_SERVER) === 'developers' && (
          <Grid item sm={6} xs={12}>
            <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(formuiSpec, null, 2)}</pre>
            </Box>
          </Grid>
        )}
      </Grid>
    </div>
  );
}
