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
import {useState} from 'react';
import makeStyles from '@mui/styles/makeStyles';

import {Grid, Paper} from '@mui/material';

import {useTheme} from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import FieldsListCard from './FieldsListCard';
import {FormForm, AutocompleteForm} from '../FormElement';
import {TabTab} from './TabTab';
import TabPanel from './TabPanel';
import {getprojectform, getacessoption} from '../data/ComponentSetting';
import {CloseButton, AddButton, ProjectSubmit} from './ProjectButton';
import ConfirmdeleteDisalog from './ConfirmdeleteDisalog';
import SectionComponents from './PSectionComponents';
/* eslint-disable @typescript-eslint/no-unused-vars */

const useStyles = makeStyles(theme => ({
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
}));
type SectionTabProps = {
  formuiSpec: any;
  formvariants: any;
  setFormuiSpec: any;
  formuiview: any;
  initialValues: any;
  setinitialValues: any;
  projectvalue: any;
  handleAutocomplete: any;
  formcomponents: any;
  designvalidate: any;
  fieldvalue: any;
  handleChangetabfield: any;
  handleChangeFormSection: any;
  setfieldValue: any;
  formsectionvalue: any;
  handleAddField: any;
  deleteform: any;
  setFormComponents: any;
};

export default function SectionTab(props: SectionTabProps) {
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
    deleteform,
    formuiSpec,
    projectvalue,
    handleAddField,
    ...others
  } = props;
  // const [fieldvalue,setFieldValue]=useState(0)
  const handleSubmitFormSection = () => {
    console.log('section submit');
  };
  const [isAddField, setIsAddField] = useState(true);
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
              props.projectvalue['access']['access' + formvariants] ?? ['admin']
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
            Select each new component, they will be automatically layout in the
            interface, then config each of them
          </Alert>

          {fieldvalue === 1 &&
          formuiview !== '' &&
          formcomponents[formuiview].length > 0 ? (
            <SectionComponents
              formuiview={formuiview}
              formvariants={formvariants}
              formcomponents={formcomponents}
              formuiSpec={formuiSpec}
              projectvalue={projectvalue}
              {...others}
            />
          ) : (
            ''
          )}
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
}
