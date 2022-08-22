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
 * Description:This is the file about form design, all uiSpec related should be defined here
 *   TODO: [BUG] when form tab changes, section tab should be reset(Should use tabPanels instead??)
 *   TODO: [BUG] edit Project is not working, can't read information for project
 *   TODO: with the form component, need to change to drag element
 *   TODO: [BUG] Validationschma
 *   TODO: [BUG] uiSpec ini setup issue for creating new notebook, and form component issue for edit existing project
 */
import React from 'react';
import {useState, useEffect} from 'react';
import makeStyles from '@mui/styles/makeStyles';
import {Grid} from '@mui/material';

import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import {FormConnectionCard} from './PSettingCard';

import {TabEditable} from './TabTab';

import TabPanel from './TabPanel';
import {getid, updateuiSpec, uiSpecType} from '../data/ComponentSetting';
import {ProjectValueList, FAIMShandlerType} from '../../../../datamodel/ui';
import {HRID_STRING} from '../../../../datamodel/core';

import {getValidationSchemaForViewset} from '../../../../data_storage/validation';
import {FormTab} from './ProjectComponent';
import {grey} from '@mui/material/colors';
/* eslint-disable @typescript-eslint/no-unused-vars */

const useStyles = makeStyles(theme => ({
  formtabcard: {
    minHeight: 200,
    backgroundColor: grey[200],
  },
}));

const sections_default = ['SECTION1'];
const variant_default = ['FORM1'];
const form_default = {FORM1SECTION1: []};
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
  projectvalue: ProjectValueList;
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
  const ini = {_id: project_id ?? 'new_notebook'};
  const [initialValues, setinitialValues] = useState(ini);
  const [formcomponents, setFormComponents] = useState<formcomponents>(
    form_default
  );
  const [isAddField, setIsAddField] = useState(true);
  const [currentView, setCurrentView] = useState(sections_default[0]);
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
    let isactive = true;
    if (isactive) {
      setinit();
    }
    return () => {
      isactive = false;
    };
  }, []);

  useEffect(() => {
    //this function should be used to get new project ui when project_id changes??
    let isactive = true;
    if (isactive) {
      setinit();
    }
    return () => {
      isactive = false;
    };
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
    try {
      setdesignvalidate(
        getValidationSchemaForViewset(formdesignuiSpec, formuiview)
      );
    } catch (error) {
      console.error('not get validation');
    }

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
    setFormNameValue(index);
  };

  const ChangeVariants = (index: number, id: string) => {
    setFormVariants(id);
    setFormNameValue(index);
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
      setfieldValue(0); //TODO: remove it
      console.log(formvariants + formuiview);
    } else {
      setsectiontabs([]);
      setformuiview('');
      setCurrentView('');
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
      setformsectionvalue(0);
    } else {
      //after tabname changes direct user to form1 section1
      // const tabname = formuiSpec['visible_types'][0];
      // console.error(tabname);
      // ChangeVariants(0, tabname);

      console.debug('Current Form is ' + formvariants);
    }
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
      setformsectionvalue(sectiontabs.length - 1);
    } else {
      // setCurrentView(sectiontabs[0]);
      // setformuiview(formuiSpec['viewsets'][formvariants]['views'][0]);
    }
    setfieldValue(0); //TODO: remove it
    setDesignvalue('' + getid());
  };

  const handleChangetabfield = (event: any, index: number) => {
    setfieldValue(index);
  };

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
        const {newformcom, initialfieldvalue} = updateuiSpec('newfromui', {
          formuiSpec: newviews,
          formcomponents: formcomponents,
          access: accessgroup,
          initialfieldvalue: initialValues,
          projectvalue: projectvalue,
        });

        setinitialValues({...initialValues, ...initialfieldvalue});
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

      setFormuiSpec({...formuiSpec, fields: newviews.fields});
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
      //change for hrid
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
    let indextab = formnamevalue;
    if (indextab < 0) indextab = 0;
    if (indextab === formtabs.length - 1) {
      //formtabs.indexOf(formlabel)==(formtabs.length-1) last form
      //go to next tab: overview
      props.setProjecttabvalue(2);
    } else {
      const index = formnamevalue + 1;
      const id = formuiSpec[VISIBLE_TYPE][index];
      ChangeVariants(index, id);
    }
  };

  const deleteform = (sectionid: string, type: string) => {
    console.debug(type);
    if (type === 'SECTION') {
      //for section delete section will empty the fields but the field will be saved
      const newui = props.formuiSpec;
      const newtabs = sectiontabs.filter(
        (tab: string) => tab !== newui['views'][sectionid]['label']
      );
      const tabindex = newtabs.length;
      setsectiontabs(newtabs);

      newui['viewsets'][formvariants]['views'] = newui['viewsets'][
        formvariants
      ]['views'].filter((view: string) => view !== sectionid);
      const views = newui.views;
      delete views[sectionid];
      setFormuiSpec({...newui, views: views});

      //reset the formsection in projectvalue
      const newpropjectvalue = projectvalue;
      delete newpropjectvalue['sections'][sectionid];
      delete newpropjectvalue['access']['access' + sectionid];
      setProjectValue({...newpropjectvalue});

      setCurrentView(newtabs[tabindex]);
      setformuiview(formuiSpec['viewsets'][formvariants]['views'][tabindex]);
      setformsectionvalue(tabindex);
      setfieldValue(0);
      setDesignvalue('' + getid());
      setFormComponents({...formcomponents, [sectionid]: []});
    } else if (type === 'FORM') {
      //for form, the form will be kept, but won't be able to see to user, and can't be linked or contained to any other form and can be un-deleted.
      //The created record will be kept but user can't create new record????
      const newui = props.formuiSpec;
      newui['viewsets'][sectionid]['isdeleted'] = true;
      newui['viewsets'][sectionid]['is_visible'] = false;
      setFormuiSpec({...newui});
    }
  };

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
              <FormTab
                formvariants={formvariants}
                handleAutocomplete={handleAutocomplete}
                handleChangeFormAction={handleChangeFormAction}
                gotonext={gotonext}
                sectiontabs={sectiontabs}
                formsectionvalue={formsectionvalue}
                handelonChangeSection={handelonChangeSection}
                fieldvalue={fieldvalue}
                handelonChangeLabelSection={handelonChangeLabelSection}
                handleChangetabfield={handleChangetabfield}
                handleChangeFormSection={handleChangeFormSection}
                formuiview={formuiview}
                formcomponents={formcomponents}
                setfieldValue={setfieldValue}
                handleAddField={handleAddField}
                designvalidate={designvalidate}
                initialValues={initialValues}
                formuiSpec={formuiSpec}
                setFormuiSpec={setFormuiSpec}
                setinitialValues={setinitialValues}
                projectvalue={projectvalue}
                setProjectValue={setProjectValue}
                deleteform={deleteform}
                setFormComponents={setFormComponents}
              />
            </TabPanel>
          ))}
        </Grid>
        {not_xs && formtabs.length > 1 ? (
          <Grid item sm={2} xs={12} className={classes.formtabcard}>
            {formtabs.length > 1 && formtabs[formnamevalue] !== undefined && (
              <FormConnectionCard
                tabs={formtabs}
                formuiSpec={formuiSpec}
                tabname={formtabs[formnamevalue] ?? 'form'}
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
