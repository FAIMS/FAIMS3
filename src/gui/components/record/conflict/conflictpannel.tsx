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
import {ProjectUIModel} from '../../../../datamodel/ui';
import {Formik, Form} from 'formik';
import {
  FieldWithAnnotation,
  EmptyField,
  ConflictResolveIcon,
} from './conflictfield';
import {
  FieldButtonGroup,
  ConflictSaveButton,
  FieldEmptyButton,
} from './conflictbutton';
import {CircularProgress} from '@mui/material';

function getinitial(data: any, fieldslist: Array<string>) {
  const initialvalues: {[key: string]: string} = {};
  fieldslist.map(
    field => (initialvalues[field] = data['fields'][field]['data'])
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
  } = props;
  if (data === null) return <CircularProgress size={12} thickness={4} />;
  const initialvalues = getinitial(data, fieldslist);
  return (
    <>
      <Formik
        enableReinitialize={type === 'middle' ? true : false}
        initialValues={initialvalues}
        validateOnMount={true}
        onSubmit={(values, {setSubmitting}) => {
          setSubmitting(false);
        }}
      >
        {formProps => {
          return (
            <Form>
              {ui_specification['views'][view]['fields'].map(
                fieldName =>
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
};
function ConflictButton(props: ConflictButtonProps) {
  const {istoggleAll, isconflict, isclick} = props;
  if (istoggleAll && isconflict)
    return (
      <FieldButtonGroup
        type={props.type}
        id={props.fieldName}
        setFieldChanged={props.setFieldChanged}
        isclick={isclick}
      />
    );
  if (istoggleAll && !isconflict) return <FieldEmptyButton />;
  if (!istoggleAll && isconflict)
    return (
      <FieldButtonGroup
        type={props.type}
        id={props.fieldName}
        setFieldChanged={props.setFieldChanged}
        isclick={isclick}
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
  inirevision: string;
  onButtonSave: any;
  fieldslist: Array<string>;
  conflictfields: Array<string>;
  istoggleAll: boolean;
};

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
    fieldslist,
    conflictfields,
    istoggleAll,
  } = props;

  return (
    <Box mb={3}>
      {conflictB !== null && conflictB !== null && (
        <Grid container>
          <ConflictResolveIcon
            numResolved={0}
            numUnResolved={3}
            num={conflictfields.length}
          />
          <ConflictSaveButton onButtonClick={onButtonSave} />
        </Grid>
      )}
      <Grid
        container
        style={{
          height: '500px',
          overflowY: 'auto',
          minWidth: '800px',
          overflowX: 'auto',
        }}
        columns={14}
      >
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
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
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
          />
        </Grid>
        <Grid item sm={1} xs={1} md={1}>
          {conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(fieldName => (
              <ConflictButton
                istoggleAll={istoggleAll}
                isclick={isclickLeft}
                type={'left'}
                fieldName={fieldName}
                setFieldChanged={setFieldChanged}
                isconflict={conflictfields.includes(fieldName)}
              />
            ))}
        </Grid>
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={chosenvalues === null || conflictB === null}
            isspin={false}
            text={''}
            data={chosenvalues !== null ? chosenvalues : null}
            styletypes={styletypeMiddle}
            view={view}
            type="middle"
            ui_specification={ui_specification}
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
          />
        </Grid>
        <Grid item sm={1} xs={1} md={1}>
          {conflictB !== null &&
            conflictB !== null &&
            ui_specification['views'][view]['fields'].map(fieldName => (
              <ConflictButton
                istoggleAll={istoggleAll}
                isclick={isclickRight}
                type={'right'}
                fieldName={fieldName}
                setFieldChanged={setFieldChanged}
                isconflict={conflictfields.includes(fieldName)}
              />
            ))}
        </Grid>
        <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
          <ConflictPanelForm
            isloading={conflictA === null || conflictB === null}
            isspin={revisionlist[1] === ''}
            text={'Select a second conflict to resolve'}
            data={conflictB !== null ? conflictB : null}
            styletypes={styletypeRight}
            view={view}
            type="right"
            ui_specification={ui_specification}
            fieldslist={fieldslist}
            conflictfields={conflictfields}
            istoggleAll={istoggleAll}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
