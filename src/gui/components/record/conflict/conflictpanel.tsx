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
 *   Conflict Resolve Working Panel include ConflictA Panel, Resolved Panel and ConflictB Panel
 */

import React from 'react';
import {Grid, Box} from '@mui/material';
import {ProjectUIModel} from 'faims3-datamodel';
import {Formik, Form} from 'formik';
import {FieldWithAnnotation, EmptyField} from './conflictfield';
import {FieldButtonGroup, FieldEmptyButton} from './conflictbutton';
import {CircularProgress} from '@mui/material';
import {ProjectID} from 'faims3-datamodel';
function getinitial(data: any, fieldslist: Array<string>) {
  const initialvalues: {[key: string]: string} = {};
  fieldslist.map(field =>
    data['fields'][field] !== undefined
      ? (initialvalues[field] = data['fields'][field]['data'])
      : field
  );
  return initialvalues;
}

type ConflictSectionPanelProps = {
  ui_specification: ProjectUIModel;
  view: string;
  type?: string;
  data: any;
  styletypes: iscolourList;
  fieldslist: Array<string>;
  conflictfields: Array<string>;
  istoggleAll: boolean;
  isSyncing: string;
  project_id: ProjectID;
};
function ConflictSectionPanel(props: ConflictSectionPanelProps) {
  const {
    ui_specification,
    view,
    data,
    type,
    styletypes,
    fieldslist,
    conflictfields,
    istoggleAll,
    isSyncing,
  } = props;
  if (data === null) return <CircularProgress size={12} thickness={4} />;
  const initialvalues = getinitial(data, fieldslist);
  initialvalues['_project_id'] = props.project_id;
  if (type === 'middle') console.debug('initial values', initialvalues);
  return (
    <>
      <Formik
        enableReinitialize={type === 'middle'}
        initialValues={initialvalues}
        validateOnMount={false}
        onSubmit={(values, {setSubmitting}) => {
          setSubmitting(false);
        }}
      >
        {formProps => {
          return (
            <Form>
              {ui_specification['views'][view]['fields'].map(
                fieldName =>
                  ui_specification['fields'][fieldName]['component-name'] !==
                    'RandomStyle' &&
                  (istoggleAll === true ||
                    (istoggleAll === false &&
                      conflictfields.includes(fieldName))) && (
                    <FieldWithAnnotation
                      fieldName={fieldName}
                      fieldConfig={ui_specification['fields'][fieldName]}
                      formProps={formProps}
                      type={type}
                      data={data}
                      styletype={styletypes[fieldName]}
                      isSyncing={isSyncing}
                    />
                  )
              )}
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
  return isloading ? (
    <EmptyField
      isloading={isloading}
      key={ui_specification['views'][view]['fields'][0]}
      isspin={isspin}
      text={text}
    />
  ) : (
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
      fieldslist={props.fieldslist}
      conflictfields={props.conflictfields}
      istoggleAll={props.istoggleAll}
      isSyncing={props.isSyncing}
      project_id={props.project_id}
    />
  );
}
type ConflictButtonProps = {
  istoggleAll: boolean;
  isconflict: boolean; //conflictfields.includes(fieldName)
  fieldName: string;
  setFieldChanged: any;
  isclick: isclicklist;
  type: string;
  disbaled: {[key: string]: boolean};
  styletype?: string;
};
function ConflictButton(props: ConflictButtonProps) {
  const {istoggleAll, isconflict, isclick, disbaled, styletype} = props;
  if (istoggleAll && isconflict && styletype !== 'automerge')
    return (
      <FieldButtonGroup
        type={props.type}
        id={props.fieldName}
        setFieldChanged={props.setFieldChanged}
        isclick={isclick}
        disbaled={disbaled}
      />
    );
  if (istoggleAll && !isconflict) return <FieldEmptyButton />;
  // add for checking if field is auto merged
  if (isconflict && styletype === 'automerge') return <FieldEmptyButton />;
  if (!istoggleAll && isconflict)
    return (
      <FieldButtonGroup
        type={props.type}
        id={props.fieldName}
        setFieldChanged={props.setFieldChanged}
        isclick={isclick}
        disbaled={disbaled}
      />
    );
  return <div></div>;
}

type ConflictPanelProp = {
  ui_specification: ProjectUIModel;
  view: string;
  type: string;
  conflictA: any;
  conflictB: any;
  chosenvalues: any;
  isclickLeft: isclicklist;
  isclickRight: isclicklist;
  styletypeLeft: iscolourList;
  styletypeMiddle: iscolourList;
  styletypeRight: iscolourList;
  setFieldChanged: any;
  revisionlist: Array<string>;
  fieldslist: Array<string>;
  conflictfields: Array<string>;
  istoggleAll: boolean;
  isSyncing: string;
  disbaledLeft: {[key: string]: boolean};
  disbaledRight: {[key: string]: boolean};
  project_id: ProjectID;
};

export default function ConflictPanel(props: ConflictPanelProp) {
  const {
    ui_specification,
    view,
    conflictA,
    conflictB,
    setFieldChanged,
    chosenvalues,
    revisionlist,
    fieldslist,
    conflictfields,
    istoggleAll,
    isSyncing,
  } = props;

  const isconflictrevision = revisionlist[0] === '' || revisionlist[1] === '';

  return (
    <Box mb={3}>
      <Grid
        container
        style={{
          minHeight: '300px',
          minWidth: '960px',
          overflowX: 'auto',
        }}
        columns={14}
      >
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={conflictA === null || conflictB === null}
            isspin={isconflictrevision}
            text={
              'Fields will show here once a second conflict has been selected. Use the dropdown at the top right to continue'
            }
            data={conflictA !== null ? conflictA : null}
            styletypes={props.styletypeLeft}
            view={view}
            type="left"
            ui_specification={ui_specification}
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
            isSyncing={isSyncing}
            project_id={props.project_id}
          />
        </Grid>
        <Grid item sm={1} xs={1} md={1}>
          {!isconflictrevision &&
            conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(
              fieldName =>
                ui_specification['fields'][fieldName]['component-name'] !==
                  'RandomStyle' && (
                  <ConflictButton
                    istoggleAll={istoggleAll}
                    isclick={props.isclickLeft}
                    type={'left'}
                    fieldName={fieldName}
                    setFieldChanged={setFieldChanged}
                    isconflict={conflictfields.includes(fieldName)}
                    disbaled={props.disbaledLeft}
                    styletype={props.styletypeMiddle[fieldName]}
                  />
                )
            )}
        </Grid>
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={chosenvalues === null || conflictB === null}
            isspin={isconflictrevision}
            text={''}
            data={chosenvalues !== null ? chosenvalues : null}
            styletypes={props.styletypeMiddle}
            view={view}
            type="middle"
            ui_specification={ui_specification}
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
            isSyncing={isSyncing}
            project_id={props.project_id}
          />
        </Grid>
        <Grid item sm={1} xs={1} md={1}>
          {!isconflictrevision &&
            conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(
              fieldName =>
                ui_specification['fields'][fieldName]['component-name'] !==
                  'RandomStyle' && (
                  <ConflictButton
                    istoggleAll={istoggleAll}
                    isclick={props.isclickRight}
                    type={'right'}
                    fieldName={fieldName}
                    setFieldChanged={setFieldChanged}
                    isconflict={conflictfields.includes(fieldName)}
                    disbaled={props.disbaledRight}
                    styletype={props.styletypeMiddle[fieldName]}
                  />
                )
            )}
        </Grid>
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={conflictA === null || conflictB === null}
            isspin={isconflictrevision}
            text={'Select a second conflict to resolve'}
            data={conflictB !== null ? conflictB : null}
            styletypes={props.styletypeRight}
            view={view}
            type="right"
            ui_specification={ui_specification}
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
            isSyncing={isSyncing}
            project_id={props.project_id}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
