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
 * Filename: RecordTabBar.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Grid, Box} from '@mui/material';
import {ProjectUIModel, Record} from '../../../../datamodel/ui';
import {Formik, Form} from 'formik';
import {
  FieldWithAnnotation,
  EmptyField,
  ConflictResolveIcon,
} from './conflictfield';
import {FieldButtonGroup, ConflictSaveButton} from './conflictbutton';
import {CircularProgress} from '@mui/material';

type ConflictSectionPanelProps = {
  ui_specification: ProjectUIModel;
  view: string;
  type?: string;
  data: any;
  styletypes: iscolourList;
};
function ConflictSectionPanel(props: ConflictSectionPanelProps) {
  const {ui_specification, view, data, type, styletypes} = props;
  if (data === null) return <CircularProgress size={12} thickness={4} />;
  return (
    <>
      <Formik
        enableReinitialize={type === 'middle' ? true : false}
        initialValues={data['data']}
        validateOnMount={true}
        onSubmit={(values, {setSubmitting}) => {
          setSubmitting(false);
        }}
      >
        {formProps => {
          return (
            <Form>
              {ui_specification['views'][view]['fields'].map(fieldName => (
                <FieldWithAnnotation
                  fieldName={fieldName}
                  fieldConfig={ui_specification['fields'][fieldName]}
                  formProps={formProps}
                  type={type}
                  data={data}
                  styletype={styletypes[fieldName]}
                />
              ))}
            </Form>
          );
        }}
      </Formik>
    </>
  );
}
type loadingProps = {
  ui_specification: ProjectUIModel;
  view: string;
  isspin: boolean;
  isloading?: boolean;
  text?: string;
};
function LoadingSpin(props: loadingProps) {
  const {ui_specification, view, isspin, text, isloading} = props;
  return (
    <>
      {ui_specification['views'][view]['fields'].map(
        (field: string, index: number) => (
          <EmptyField
            isloading={isloading}
            key={field}
            isspin={index === 0 ? isspin : false}
            text={text}
          />
        )
      )}
    </>
  );
}

type isclicklist = {[key: string]: boolean};
type iscolourList = {[key: string]: string};
// FormikProps<{[key: string]: unknown}>
type ConflictPanelProp = {
  ui_specification: ProjectUIModel;
  view: string;
  type: string;
  conflictA: Record;
  conflictB: any;
  chosenvalues: any;
  isclickLeft: isclicklist;
  isclickRight: isclicklist;
  styletypeLeft: iscolourList;
  styletypeMiddle: iscolourList;
  styletypeRight: iscolourList;
  setFieldChanged: any;
  revisionlist: Array<string>;
  inirevision: string;
  onButtonSave: any;
};

const cardgridstyle = {
  backgroundColor: 'white',
};
type ConflictPanelFormProps = any;
function ConflictPanelForm(props: ConflictPanelFormProps) {
  return props.isloading ? (
    <LoadingSpin
      view={props.view}
      ui_specification={props.ui_specification}
      isspin={props.type === 'middle' ? false : true}
      isloading={props.isspin}
      text={props.text}
    />
  ) : (
    <ConflictSectionPanel
      data={props.data}
      view={props.view}
      ui_specification={props.ui_specification}
      type={props.type}
      styletypes={props.styletypes}
    />
  );
}

export default function ConflictPanel(props: ConflictPanelProp) {
  const {
    ui_specification,
    view,
    conflictA,
    conflictB,
    styletypeLeft,
    styletypeRight,
    styletypeMiddle,
    setFieldChanged,
    isclickLeft,
    isclickRight,
    chosenvalues,
    revisionlist,
    inirevision,
    onButtonSave,
  } = props;

  return (
    <Box mb={3}>
      {conflictB !== null && conflictB !== null && (
        <Grid container>
          <ConflictResolveIcon numResolved={2} numUnResolved={3} num={5} />
          <ConflictSaveButton onButtonClick={onButtonSave} />
        </Grid>
      )}
      <Grid container style={{height: '500px', overflowY: 'auto'}} columns={14}>
        <Grid item sm={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={conflictA === null || conflictB === null}
            isspin={
              !(
                revisionlist[0] !== '' &&
                revisionlist[1] !== inirevision &&
                revisionlist[1] !== ''
              )
            }
            text={
              'Fields will show here once a second conflict has been selected. Use the dropdown at the top right to continue'
            }
            data={conflictA !== null ? conflictA : null}
            styletypes={styletypeLeft}
            view={view}
            type="left"
            ui_specification={ui_specification}
          />
        </Grid>
        <Grid item sm={1} xs={12}>
          {conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(fieldName => (
              <FieldButtonGroup
                type={'left'}
                id={fieldName}
                setFieldChanged={setFieldChanged}
                isclick={isclickLeft}
              />
            ))}
        </Grid>
        <Grid item sm={4} xs={12} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={chosenvalues === null || conflictB === null}
            isspin={false}
            text={''}
            data={chosenvalues !== null ? chosenvalues : null}
            styletypes={styletypeMiddle}
            view={view}
            type="middle"
            ui_specification={ui_specification}
          />
        </Grid>
        <Grid item sm={1} xs={12}>
          {conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(fieldName => (
              <FieldButtonGroup
                type={'right'}
                id={fieldName}
                setFieldChanged={setFieldChanged}
                isclick={isclickRight}
              />
            ))}
        </Grid>
        <Grid item sm={4} xs={12} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={conflictA === null || conflictB === null}
            isspin={revisionlist[1] === ''}
            text={'Select a second conflict to resolve'}
            data={conflictB !== null ? conflictB : null}
            styletypes={styletypeRight}
            view={view}
            type="right"
            ui_specification={ui_specification}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
