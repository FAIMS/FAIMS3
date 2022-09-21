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
 * Filename: view.tsx
 * Description:
 *   TODO
 *   20220620 BBS Adjusted sm to 11 from 8 to get rid of the awful margin reported in FAIMS3-328
 */

import React, {useEffect, useState} from 'react';
import {FormikProps} from 'formik';
import Alert from '@mui/material/Alert';
import {ProjectUIModel} from '../../../datamodel/ui';
import RecordDraftState from '../../../sync/draft-state';
import {getComponentFromFieldConfig} from './fields';
import {Annotation, AnnotationField} from './Annotation';
import {Grid} from '@mui/material';
import {Box} from '@mui/material';
import {EditConflictDialog} from './conflict/conflictDialog';
// import makeStyles from '@mui/styles/makeStyles';
// import {useTheme} from '@mui/material/styles';
type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState?: RecordDraftState;
  annotation: any;
  handerannoattion: any;
  isSyncing?: string;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
  fieldNames: string[]; //add for branching logic
  disabled?: boolean; // add for view tab or edit tab
};
type SingleComponentProps = {
  fieldName: string;
  fields: {[key: string]: any};
  index: number;
  formProps: FormikProps<{[key: string]: unknown}>;
  annotation: any;
  handerannoattion: any;
  draftState?: RecordDraftState;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
  isSyncing?: string;
  disabled?: boolean; // add for view tab or edit tab
};

function SingleComponent(props: SingleComponentProps) {
  const conflictfields = props.conflictfields;
  const fieldName = props.fieldName;
  const fields = props.fields;
  const [isclicked, setIsClick] = useState(
    props.disabled === true ? true : false
  );
  const fieldConfig = fields[fieldName];
  const label =
    fieldConfig['component-parameters']['InputLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['InputLabelProps']['label']
      : fieldConfig['component-parameters']['FormLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['FormLabelProps']['children']
      : fieldConfig['component-parameters']['FormControlLabelProps'] !==
        undefined
      ? fieldConfig['component-parameters']['FormControlLabelProps']['children']
      : fieldName;

  return (
    <Box
      mb={3}
      key={fieldName + props.index}
      sx={{
        boxShadow: isclicked ? 8 : 0,
        padding: isclicked ? '10px 5px' : '3px 0px',
      }}
    >
      <Grid container>
        <Grid item xs={12} sm={10} md={10} lg={11}>
          {getComponentFromFieldConfig(
            fields[fieldName],
            fieldName,
            props.formProps,
            props.isSyncing,
            props.disabled
          )}
        </Grid>
        <Grid
          item
          lg={1}
          md={2}
          sm={2}
          xs={12}
          style={{marginTop: '0.5em', paddingLeft: '0.5em'}}
          container
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          <Grid item style={{paddingLeft: '5px'}}>
            {props.annotation !== undefined &&
              props.disabled !== true && //added for show annotation directly
              fields[fieldName].meta !== undefined &&
              fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
              fields[fieldName]['component-name'] !== 'TemplatedStringField' &&
              fields[fieldName]['component-name'] !== 'RandomStyle' && (
                <Annotation
                  key={'annotation' + fieldName + 'box'}
                  setIsClick={setIsClick}
                  isclicked={isclicked}
                  field={fields[fieldName]}
                />
              )}
          </Grid>
          <Grid item style={{paddingLeft: '5px'}}>
            {' '}
            {conflictfields !== null &&
              conflictfields !== undefined &&
              conflictfields.includes(fieldName) && (
                <EditConflictDialog
                  label={label}
                  handleChangeTab={props.handleChangeTab}
                />
              )}{' '}
          </Grid>
        </Grid>
        {props.annotation !== undefined &&
          fields[fieldName].meta !== undefined &&
          fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
          fields[fieldName]['component-name'] !== 'TemplatedStringField' &&
          fields[fieldName]['component-name'] !== 'RandomStyle' && (
            <Grid item sm={12} xs={12} style={{margin: '0 0 1em 0'}}>
              <AnnotationField
                key={'annotation' + fieldName + 'box'}
                fieldName={fieldName}
                // formProps={this.props.formProps}
                field={fields[fieldName]}
                annotation={props.annotation}
                handerannoattion={props.handerannoattion}
                isclicked={isclicked}
                disabled={props.disabled ?? false}
              />
            </Grid>
          )}
      </Grid>
    </Box>
  );
}

export function ViewComponent(props: ViewProps) {
  const ui_specification = props.ui_specification;
  const fieldNames: string[] = props.fieldNames;
  const fields = ui_specification.fields;
  const [error, setError] = useState(true);

  useEffect(() => {
    let isactive = true;
    if (isactive) {
      let iserror = false;
      fieldNames.map(field =>
        props.formProps.errors[field] !== undefined ? (iserror = true) : field
      );
      setError(iserror);
    }

    return () => {
      isactive = false;
    }; // cleanup toggles value,
  }, [props.formProps]);
  console.log(props.conflictfields);
  return (
    <React.Fragment>
      {fieldNames.map((fieldName, index) => (
        <SingleComponent
          fieldName={fieldName}
          fields={fields}
          formProps={props.formProps}
          draftState={props.draftState}
          annotation={props.annotation}
          handerannoattion={props.handerannoattion}
          index={index}
          key={index}
          isSyncing={props.isSyncing}
          conflictfields={props.conflictfields}
          handleChangeTab={props.handleChangeTab}
          disabled={props.disabled}
        />
      ))}
      {!props.formProps.isValid && error !== false && (
        <Alert severity="error">
          Form has errors, please scroll up and make changes before submitting.
        </Alert>
      )}
      {!props.formProps.isValid && error === false && (
        <Alert severity="warning">
          Form has errors, please check other tabs before submitting.
        </Alert>
      )}
    </React.Fragment>
  );
}
