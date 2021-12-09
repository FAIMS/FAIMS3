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
import {makeStyles} from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';

import {Grid, Typography, Paper, Card} from '@material-ui/core';
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

const sections_default = ['SECTION1'];
const variant_default = ['FORM1'];
const form_defult = {FORM1SECTION1: []};
const VISIBLE_TYPE = 'visible_types';
const variant_label = 'Form1';
const DefaultAnnotation = {
  annotation_label: 'annotation',
  annotation: true,
  uncertainty: {
    include: false,
    label: 'uncertainty',
  },
};

type ProjectDesignProps = {
  project_id: string | null;
  formuiSpec: uiSpecType;
  setFormuiSpec: FAIMShandlerType;
  handleSaveUiSpec: FAIMShandlerType;
  accessgroup: Array<string>;
  projectvalue: ProjevtValueList;
  setProjectValue: FAIMShandlerType;
  setProjecttabvalue: FAIMShandlerType;
};
type formcomponents = any;
// eslint-disable-next-line
export default function ProjectDesignTab(props: ProjectDesignProps) {
  const theme = useTheme();
  const classes = useStyles(theme);
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const {
    project_id,
    formuiSpec,
    setFormuiSpec,
    accessgroup,
    projectvalue,
    setProjectValue,
    ...others
  } = props;
  const ini = {_id: project_id ?? 'new_notbook'};
  const [initialValues, setinitialValues] = useState(ini);
  const [formcomponents, setFormComponents] = useState<formcomponents>(
    form_defult
  );
  const [isAddField, setIsAddField] = useState(true);
  const [currentView, setCurrentView] = useState(sections_default[0]);
  const [formlabel, setformlabel] = useState<string>(variant_label);
  const [designvalue, setDesignvalue] = useState<string>('settings');
  const [settingvalue, setsettingvalue] = useState<{fields: {}; views: {}}>({
    fields: {},
    views: {},
  });
  const [formView, setFormView] = useState('start-view');
  const [formvariants, setFormVariants] = useState<string>(variant_default[0]);
  const [formuiview, setformuiview] = useState(formvariants + currentView);
  const [formtabs, setformTabs] = useState<Array<string>>([]);
  const [sectiontabs, setsectiontabs] = useState<Array<string>>([]);

  const [projecttabvalue, setProjecttabvalue] = useState(0);
  const [error, setError] = useState<any>(null);
  const [fieldvalue, setfieldValue] = useState(0); //field tab
  const [formvalue, setformvalue] = useState(0); //formtabs for each form
  const [formnamevalue, setFormNameValue] = useState(0);
  const [formsectionvalue, setformsectionvalue] = useState(0);
  const [designvalidate, setdesignvalidate] = useState<any>(null);
  const [formdesignuiSpec, setformdesignuiSpec] = useState<any>({
    viewsets: {
      settings: {
        views: ['settings'],
        label: 'settings',
      },
    },
    fields: {},
    views: {
      settings: {
        fields: [],
        uidesign: 'form',
        label: 'settings',
      },
    },
  });

  useEffect(() => {
    setinit();
  }, []);

  useEffect(() => {
    //this function should be used to get new project ui when project_id changes??

    setinit();
  }, [project_id]);

  const generateunifromformui = (formui: uiSpecType) => {
    const tabs: Array<string> = [];
    formui[VISIBLE_TYPE].map((tab: string) =>
      tabs.push(formuiSpec['viewsets'][tab]['label'] ?? tab)
    );
    const {newformcom, initialfieldvalue, formdesignuiSpec} = updateuiSpec(
      'newfromui',
      {
        formuiSpec: formui,
        formcomponents: formcomponents,
        access: accessgroup,
        initialfieldvalue: initialValues,
        projectvalue: projectvalue,
      }
    );

    const newformvariants = formui[VISIBLE_TYPE][0];
    setformdesignuiSpec({...formdesignuiSpec});
    setFormVariants(newformvariants);
    setformTabs(
      formui[VISIBLE_TYPE].map(
        (tab: string) => (tab = formuiSpec['viewsets'][tab]['label'] ?? tab)
      )
    );

    setinitialValues({...initialValues, ...initialfieldvalue});
    setsectiontabs(
      formui['viewsets'][newformvariants]['views'].map(
        (tab: string) => (tab = formuiSpec['views'][tab]['label'] ?? tab)
      )
    );
    setFormComponents(newformcom);
    setFormuiSpec(formui);
    setformlabel(formtabs[0]);
    setdesignvalidate(
      getValidationSchemaForViewset(formdesignuiSpec, formuiview)
    );
    return true;
  };

  const setinit = () => {
    // if(props.project_id===undefined){
    // generate empty form
    const view = formvariants + sections_default[0];
    setCurrentView(view);

    setformTabs([variant_label]);
    setsectiontabs(sections_default);

    setFormComponents((prevalue: formcomponents) => {
      const newvalue = prevalue;
      if (newvalue[view] === undefined) newvalue[view] = [];
      return newvalue;
    });
    if (formuiSpec !== null) {
      generateunifromformui(formuiSpec);
    }
  };

  const handleAddField = (id: any) => {
    const uuid = getid();
    const {
      newviews,
      components,
      newuiSpeclist,
      newuiSpec,
      initialfieldvalue,
      newformdesignuiSpec,
    } = updateuiSpec('addfield', {
      uuid: uuid,
      id: id,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
      formuiview: formuiview,
      accessgroup: getinitaccess(),
      meta: {
        isannotation:
          projectvalue['forms'][formvariants] !== undefined
            ? projectvalue['forms'][formvariants]['annotation' + formvariants]
            : true,
        isuncertainty:
          projectvalue['forms'][formvariants] !== undefined
            ? projectvalue['forms'][formvariants]['uncertainty' + formvariants]
            : false,
      },
      formdesignuiSpec: formdesignuiSpec,
    });
    setformdesignuiSpec({...newformdesignuiSpec});
    setdesignvalidate(
      getValidationSchemaForViewset(newformdesignuiSpec, formuiview)
    );
    setinitialValues({
      ...initialValues,
      ...initialfieldvalue,
    });
    setFormComponents(components);
    setFormuiSpec({
      fields: newuiSpec,
      views: newviews,
      viewsets: formuiSpec.viewsets,
      visible_types: formuiSpec.visible_types,
    });
    setIsAddField(false);
    setDesignvalue('settings');
  };

  const handleRemoveField = (index: string) => {
    const {newviews, components} = updateuiSpec('removefield', {
      index: index,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
      formuiview: formuiview,
    });
    setFormComponents(components);
    setFormuiSpec({...formuiSpec, views: newviews.views});
  };
  const handleAddFieldButton = () => {
    setIsAddField(true);
  };
  const handleCloseFieldButton = () => {
    setIsAddField(false);
  };

  const handleUpFieldButton = (index: number) => {
    const {newviews, components} = updateuiSpec('switch', {
      index: index,
      type: false,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
      formuiview: formuiview,
    });
    setFormuiSpec({...formuiSpec, views: newviews.views});
    setFormComponents(components);
  };
  const handleDownFieldButton = (index: number) => {
    const {newviews, components} = updateuiSpec('switch', {
      index: index,
      type: true,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
      formuiview: formuiview,
    });
    setFormuiSpec({...formuiSpec, views: newviews.views});
    setFormComponents(components);
  };

  const handelonClickSetting = (index: string, key: string) => {
    const formcomponent = formcomponents;
    formcomponent[formuiview].map((item: any) => {
      item.id === key ? (item['designvalue'] = index) : item;
    });

    setFormComponents(formcomponent);
    setDesignvalue(index + getid());
  };

  const handelonChangeSection = (event: any, index: number) => {
    const id = formuiSpec['viewsets'][formvariants]['views'][index];
    console.log(id);
    setCurrentView(sectiontabs[index - 1]);
    setformuiview(id);
    setfieldValue(0); //TODO: remove it
    setformsectionvalue(index);
    if (formuiSpec['views'][id]['fields'].length > 0)
      setdesignvalidate(getValidationSchemaForViewset(formdesignuiSpec, id));
  };

  const handelonChangeVariants = (event: any, index: number) => {
    const id = formuiSpec[VISIBLE_TYPE][index];
    ChangeVariants(index, id);
    setformlabel(formtabs[index]);
    setFormNameValue(index);
  };

  const ChangeVariants = (index: number, id: string) => {
    setFormVariants(id);
    setFormNameValue(index);
    console.error(formnamevalue);
    if (formuiSpec['viewsets'][id]['views'].length > 0) {
      const tabs: any = [];
      if (formuiSpec['viewsets'][id]['views'].length > 0) {
        formuiSpec['viewsets'][id]['views'].map(
          (tab: string, number: number) =>
            (tabs[number] = formuiSpec['views'][tab]['label'])
        );
      }
      setsectiontabs(tabs);
      setformuiview(formuiSpec['viewsets'][id]['views'][0]);
      setCurrentView(formuiSpec['viewsets'][id]['views'][0]); // this part seems not working, check it to fix the issue
      setformvalue(0);
      setfieldValue(0); //TODO: remove it
      console.log(formvariants + formuiview);
    } else {
      setsectiontabs([]);
      setformuiview('');
      setCurrentView('');
      setformvalue(0);
      setfieldValue(0); //TODO: remove it
    }
    setDesignvalue(index + getid());
  };

  const handelonChangeLabel = (tabs: Array<string>, type: string) => {
    const {newviews, components} = updateuiSpec('formvariants' + type, {
      tabs: tabs,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
    });
    setFormuiSpec({
      fields: formuiSpec.fields,
      views: newviews.views,
      viewsets: newviews.viewsets,
      visible_types: newviews.visible_types,
    });
    if (type === 'add') {
      // To fix the misread of tab names
      const tabnameindex: number = tabs.length - 1;
      const tabname = tabs[tabnameindex];
      ChangeVariants(tabnameindex, tabname);
      setformlabel(formtabs[tabs.length - 1]);
      //set default value as preselect value for formaction
      const newprojectvalue = props.projectvalue;
      newprojectvalue['forms'][tabname] = {};
      newprojectvalue['forms'][tabname]['submitAction' + tabname] =
        'Save and New';
      newprojectvalue['forms'][tabname]['annotation' + tabname] = true;
      newprojectvalue['forms'][tabname]['uncertainty' + tabname] = false;
      newprojectvalue['forms'][tabname]['formaccessinherit' + tabname] = false;
      newprojectvalue['forms'][tabname]['visible' + tabname] = true;
      newprojectvalue['access']['access' + tabname] = ['admin'];
      setProjectValue({...newprojectvalue});
    } else {
      //after tabname changes direct user to form1 section1
      const tabname = formuiSpec['visible_types'][0];
      console.error(tabname);
      ChangeVariants(0, tabname);
      setformlabel(formtabs[0]);
    }
    console.error(formvariants);
    setformsectionvalue(0);
  };

  const handelonChangeLabelSection = (tabs: Array<string>, type: string) => {
    const {newviews, components} = updateuiSpec('formvsection' + type, {
      tabs: tabs,
      formuiSpec: formuiSpec,
      formcomponents: formcomponents,
      formvariants: formvariants,
    });
    setFormuiSpec({
      fields: formuiSpec.fields,
      views: newviews.views,
      viewsets: newviews.viewsets,
      visible_types: newviews.visible_types,
    });
    setFormComponents(components);
    if (type === 'add') {
      // To fix the misread of tab names
      setCurrentView(sectiontabs[sectiontabs.length - 1]);
      setformuiview(
        formuiSpec['viewsets'][formvariants]['views'][sectiontabs.length - 1]
      );
    } else {
      setCurrentView(sectiontabs[0]);
      setformuiview(formuiSpec['viewsets'][formvariants]['views'][0]);
    }
    setfieldValue(0); //TODO: remove it
    setDesignvalue('' + getid());
  };

  const handleChangetabfield = (event: any, index: number) => {
    setfieldValue(index);
  };

  const handleChangeformvalueTab = (event: any, index: number) => {
    setformvalue(index);
  };

  const submithandler = (values: any) => {};

  const getinitaccess = () => {
    try {
      return ['admin'];
    } catch (error) {
      console.error("can't get access");
      return ['admin'];
    }
  };

  const handleChangeFormSection = (event: any) => {
    const newprojectvalue = props.projectvalue;
    if (newprojectvalue['sections'] === undefined)
      newprojectvalue['sections'] = {};
    if (newprojectvalue['sections'][formuiview] === undefined)
      newprojectvalue['sections'][formuiview] = {};
    if (event.target.name.includes('accessinherit')) {
      //split it to array
      newprojectvalue['sections'][formuiview][event.target.name] =
        event.target.value === 'true';
    } else
      newprojectvalue['sections'][formuiview][event.target.name] =
        event.target.value;
    setProjectValue({
      ...props.projectvalue,
      sections: newprojectvalue.sections,
    });
  };

  const handleSubmitFormSection = (values: any) => {};

  const handleChangeFormAction = (event: any) => {
    const newproject = props.projectvalue;
    if (newproject['forms'][formvariants] === undefined) {
      newproject['forms'][formvariants] = {};
    }
    if (
      event.target.name.includes('accessinherit') ||
      event.target.name.includes('annotation') ||
      event.target.name.includes('uncertainty') ||
      event.target.name.includes('visible')
    ) {
      newproject['forms'][formvariants][event.target.name] =
        event.target.checked;
    } else
      newproject['forms'][formvariants][event.target.name] = event.target.value;

    setProjectValue({...newproject});

    if (event.target.name === 'submitAction' + formvariants) {
      const newviews = formuiSpec;
      //update uiSpecf
      newviews['viewsets'][formvariants]['submit_label'] = event.target.value;
      setFormuiSpec({...formuiSpec, viewsets: newviews.viewsets});
    }

    if (event.target.name === 'visible' + formvariants) {
      const newviews = formuiSpec;
      newviews['viewsets'][formvariants]['is_visible'] = event.target.checked;
      setFormuiSpec({...formuiSpec, viewsets: newviews.viewsets});
    }

    if (
      event.target.name === 'annotation' + formvariants ||
      event.target.name === 'uncertainty' + formvariants
    ) {
      //update uiSpec
      const newviews = formuiSpec;
      //update uiSpecf
      let fields: Array<string> = [];
      newviews['viewsets'][formvariants]['views'].map(
        (view: string) =>
          (fields = [...fields, ...newviews['views'][view]['fields']])
      );
      //set undefined meta
      if (event.target.name === 'annotation' + formvariants) {
        fields.map((field: string) => {
          if (newviews['fields'][field]['meta'] === undefined)
            newviews['fields'][field]['meta'] = DefaultAnnotation;
          newviews['fields'][field]['meta']['annotation'] =
            event.target.checked;
        });
      }

      if (event.target.name === 'uncertainty' + formvariants) {
        fields.map((field: string) => {
          if (newviews['fields'][field]['meta'] === undefined)
            newviews['fields'][field]['meta'] = DefaultAnnotation;
          newviews['fields'][field]['meta']['uncertainty']['include'] =
            event.target.checked;
        });
        const {newformcom, initialfieldvalue} = updateuiSpec('newfromui', {
          formuiSpec: newviews,
          formcomponents: formcomponents,
          access: accessgroup,
          initialfieldvalue: initialValues,
          projectvalue: projectvalue,
        });

        setinitialValues({...initialValues, ...initialfieldvalue});
      }

      setFormuiSpec({...formuiSpec, viewsets: newviews.viewsets});
    }

    setfieldValue(0); //TODO: remove it
  };

  const handleSubmitFormAction = () => {};

  const handleAutocomplete = (
    newvalue: Array<string>,
    id: string,
    type: string
  ) => {
    if (newvalue === undefined) newvalue = ['admin'];
    if (newvalue !== undefined && !newvalue.includes('admin'))
      newvalue = [...newvalue, 'admin'];
    if (type === 'form') {
      const newproj = props.projectvalue;
      if (newproj['access'] === undefined) newproj['access'] = {};
      newproj['access']['access' + id] = newvalue;
      setProjectValue({...newproj});
    } else if (type === 'uiS') {
      const newui = formuiSpec;
      newui['fields'][id]['access'] = newvalue;
      //change for hird
      if (
        newui['fields'][id]['component-name'] === 'TemplatedStringField' &&
        newui['fields'][id]['component-parameters']['hrid'] === true
      ) {
        newui['fields'][HRID_STRING + formvariants]['access'] = newvalue;
      }
      setFormuiSpec({...formuiSpec, fields: newui.fields});
    }
  };

  const gotonext = () => {
    let indextab = formtabs.indexOf(formlabel);
    if (indextab < 0) indextab = 0;
    if (indextab === formtabs.length - 1) {
      //formtabs.indexOf(formlabel)==(formtabs.length-1) last form
      //go to next tab: overview
      props.setProjecttabvalue(2);
    } else {
      const index = formtabs.indexOf(formlabel) + 1;
      const id = formuiSpec[VISIBLE_TYPE][index];
      ChangeVariants(index, id);
      setformlabel(formtabs[index]);
    }
  };

  const fieldform = (formProps: any) => {
    return formcomponents[formuiview].map((formcomponent: any, index: any) => (
      <>
        <Card className={classes.FieldCard}>
          <Grid
            container
            className={classes.newfield}
            key={`formcompoenet-form-${index}`}
          >
            <Grid item sm={10} xs={12}>
              <Grid container spacing={1}>
                <Grid item sm={4} xs={12}>
                  <Typography variant="subtitle2">
                    {formuiSpec['fields'][formcomponent['id']]!==undefined&&
                    formuiSpec['fields'][formcomponent['id']][
                      'component-parameters'
                    ]['hrid'] === true
                      ? 'Unique Human Readable ID:' + HRID_STRING + formvariants
                      : formcomponent['id']}
                  </Typography>
                  {getComponentFromField(
                    formuiSpec,
                    formcomponent['id'],
                    formProps,
                    () => {} //this is preview field only, so no need to handler changes
                  )}
                </Grid>
                <Grid item sm={1} xs={3} className={classes.settingtab}>
                  <SettingCard
                    handelonClick={handelonClickSetting}
                    key_id={formcomponent.id}
                    selected={formcomponent['designvalue']}
                  />
                </Grid>
                <Grid item sm={7} xs={9}>
                  <Typography variant="subtitle2">Configuration</Typography>
                  {!(
                    formcomponent['designvalue'] === 'meta' &&
                    formuiSpec['fields'][formcomponent['id']]['meta'] ===
                      undefined
                  ) && (
                    <ResetComponentProperties
                      namespace={formcomponent['namespace']}
                      componentName={formcomponent['componentName']}
                      uiSpec={formuiSpec}
                      setuiSpec={setFormuiSpec}
                      fieldName={formcomponent['id']}
                      formProps={formProps}
                      designvalue={formcomponent['designvalue']}
                      currentview={formuiview}
                      currentform={formvariants}
                      initialValues={initialValues}
                      setinitialValues={setinitialValues}
                      projectvalue={projectvalue}
                    />
                  )}

                  {formcomponent['designvalue'] === 'access' ? (
                    <AutocompleteForm
                      id={formcomponent['id']}
                      options={getacessoption(
                        props.projectvalue['access']['access' + formuiview] ?? [
                          'admin',
                        ]
                      )}
                      labels={
                        formuiSpec['fields'][formcomponent['id']]['access']
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
              {index > 0 ? (
                <UpButton
                  onButtonClick={handleUpFieldButton}
                  value={index}
                  id={index}
                  text="X"
                />
              ) : (
                ''
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
      </>
    ));
  };

  const compnentPanel = () => {
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
              {fieldform(formProps)}
            </Form>
          );
        }}
      </Formik>
    );
  };

  const FieldPanel = () => {
    /****section tab:
     * SectionInfotTab
     * component Tab
     ***/
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
              handleAutocomplete={handleAutocomplete}
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
            <ProjectSubmit
              id="gotonext_info"
              type="submit"
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
              ? compnentPanel()
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
    );
  };
  const SectionPanel = () => {
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
                // projectvalue={projectvalue}
                // setProjectValue={props.setProjectValue}
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
          <ProjectSubmit
            id="gotonext_info"
            type="submit"
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
          <TabEditable
            tabs={sectiontabs}
            value={formsectionvalue}
            handleChange={handelonChangeSection}
            tab_id="sectiontab"
            handelonChangeLabel={handelonChangeLabelSection}
          />
          {sectiontabs.map((sectiontab: string, index: number) => (
            <TabPanel
              value={formsectionvalue}
              index={index}
              tabname="sectiontab"
              key={'sectiontab' + index}
            >
              {FieldPanel()}
            </TabPanel>
          ))}
          {formsectionvalue === sectiontabs.length - 1 &&
            fieldvalue === 1 &&
            formuiSpec['views'][formuiview]['fields'].length > 0 && (
              <ProjectSubmit
                id="gotonext_info"
                type="submit"
                isSubmitting={false}
                text="Go To Next"
                onButtonClick={() => setformvalue(2)}
              />
            )}
        </TabPanel>
      </>
    );
  };

  //

  const FormPanel = () => {
    return (
      <Grid container>
        <Grid item sm={12} xs={12}>
          <TabEditable
            tabs={formtabs}
            value={formnamevalue}
            handleChange={handelonChangeVariants}
            tab_id="formtab"
            handelonChangeLabel={handelonChangeLabel}
          />
        </Grid>
        <Grid item sm={not_xs && formtabs.length > 1 ? 10 : 12} xs={12}>
          {formtabs.map((formtab: string, index: number) => (
            <TabPanel
              value={formnamevalue}
              index={index}
              tabname="formtab"
              key={'formtab' + index}
            >
              {SectionPanel()}
            </TabPanel>
          ))}
        </Grid>
        {not_xs && formtabs.length > 1 ? (
          <Grid item sm={2} xs={12} className={classes.formtabcard}>
            {formtabs.length > 1 && (
              <FormConnectionCard
                tabs={formtabs}
                formuiSpec={formuiSpec}
                tabname={formlabel ?? 'form'}
                form={formvariants}
              />
            )}
          </Grid>
        ) : (
          ''
        )}
      </Grid>
    );
  };

  return (
    <>
      <Alert severity="info">
        In this Tab, you design the look of your notebook, A notebook can
        contain one or more forms. Each form can contain one or more sections,
        each containing multiple components. For each tab, you can also define
        User access and form submission behaviour. Add further forms by choosing
        plus icon, edit form name by choosing edit icon.
      </Alert>

      {FormPanel()}
    </>
  );
}
