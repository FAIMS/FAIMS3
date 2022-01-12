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
import {makeStyles} from '@material-ui/core/styles';

import {Grid, Typography, Card} from '@material-ui/core';
import {useTheme} from '@material-ui/core/styles';
import {SettingCard} from './PSettingCard';
import {getComponentFromField, AutocompleteForm} from '../FormElement';
import {updateuiSpec, getacessoption} from '../data/ComponentSetting';
import {CloseButton, UpButton, DownButton} from './ProjectButton';
import {ResetComponentProperties} from '../data/componenentSetting';
import {HRID_STRING} from '../../../../datamodel/core';

/* eslint-disable @typescript-eslint/no-unused-vars */

const useStyles = makeStyles(theme => ({
  newfield: {
    // backgroundColor:'#e1e4e8',
    // borderTop:'1px solid #e1e4e8',
  },
  newfield_button: {
    textAlign: 'right',
  },
  settingtab: {
    backgroundColor: '#e1e4e8',
  },
  FieldCard: {
    width: '100%',
  },
}));

type FieldToolBarProps = {
  index: number;
  formuiSpec: any;
  formcomponents: any;
  formuiview: string;
  fieldName: string;
  setFormComponents: any;
  setFormuiSpec: any;
};
function FieldToolBar(props: FieldToolBarProps) {
  const theme = useTheme();
  const classes = useStyles(theme);
  const {
    index,
    formuiSpec,
    formcomponents,
    formuiview,
    fieldName,
    setFormComponents,
    setFormuiSpec,
  } = props;
  const length = formcomponents[formuiview].length;

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

  return (
    <Grid item sm={2} xs={12} className={classes.newfield_button}>
      {index > 0 && (
        <UpButton
          onButtonClick={handleUpFieldButton}
          value={index}
          id={index}
          text="X"
        />
      )}
      {index < length - 1 ? (
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
        value={fieldName}
        id={fieldName}
        text="X"
      />
    </Grid>
  );
}
/* eslint-disable @typescript-eslint/no-unused-vars */
type SectionComponent = {
  formuiSpec: any;
  formcomponent: any;
  formvariants: any;
  setFormuiSpec: any;
  formProps: any;
  formuiview: any;
  initialValues: any;
  setinitialValues: any;
  projectvalue: any;
  handleAutocomplete: any;
  index: number;
  formcomponents: any;
  setFormComponents: any;
};

export default function SectionComponent(props: SectionComponent) {
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
    ...others
  } = props;

  const fieldName = formcomponent['id'];
  const [designvalue, setDesignValue] = useState('settings');

  const handelonChangeSetting = (index: string, key: string) => {
    setDesignValue(index);
  };

  return (
    <>
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
                  formuiSpec['fields'][fieldName]['component-parameters'][
                    'hrid'
                  ] === true
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
                  formuiSpec['fields'][fieldName]['meta'] === undefined
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
                    labels={formuiSpec['fields'][fieldName]['access']}
                    handleAutocomplete={handleAutocomplete}
                    type={'uiS'}
                  />
                ) : (
                  ''
                )}
              </Grid>
            </Grid>
          </Grid>
          <FieldToolBar
            fieldName={fieldName}
            index={props.index}
            formuiSpec={formuiSpec}
            formcomponents={props.formcomponents}
            formuiview={formuiview}
            setFormComponents={props.setFormComponents}
            setFormuiSpec={setFormuiSpec}
          />
        </Grid>
      </Card>
      <Grid item sm={10} xs={12}>
        <br />
      </Grid>
    </>
  );
}
