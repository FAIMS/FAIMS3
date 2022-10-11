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
import {ProjectUIModel} from '../../../datamodel/ui';
import RecordDraftState from '../../../sync/draft-state';
import {getComponentFromFieldConfig} from './fields';
import {Annotation, AnnotationField} from './Annotation';
import {Box, Grid, Divider, Paper, Alert} from '@mui/material';
import {EditConflictDialog} from './conflict/conflictDialog';
import AnnotationComponent from './new_annotation';
// import makeStyles from '@mui/styles/makeStyles';
// import {useTheme} from '@mui/material/styles';
type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState: RecordDraftState;
  annotation: any;
  handerannoattion: any;
  isSyncing?: string;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
};
type SingleComponentProps = {
  fieldName: string;
  fields: {[key: string]: any};
  index: number;
  formProps: FormikProps<{[key: string]: unknown}>;
  annotation: any;
  handerannoattion: any;
  draftState: RecordDraftState;
  conflictfields?: string[] | null; // those two props are handling the conflict icons
  handleChangeTab?: any;
  isSyncing?: string;
};

function SingleComponent(props: SingleComponentProps) {
  const conflictfields = props.conflictfields;
  const fieldName = props.fieldName;
  const fields = props.fields;
  const [isclicked, setIsClick] = useState(false);
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
    <Box key={fieldName + props.index} mt={2} mb={6}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={12} md={8}>
          {getComponentFromFieldConfig(
            fields[fieldName],
            fieldName,
            props.formProps,
            props.isSyncing
          )}
        </Grid>
        {conflictfields !== null &&
          conflictfields !== undefined &&
          conflictfields.includes(fieldName) && (
            <Grid item xs={12} sm={12} md={4}>
              <EditConflictDialog
                label={label}
                handleChangeTab={props.handleChangeTab}
              />
            </Grid>
          )}
        {props.annotation !== undefined &&
          fields[fieldName].meta !== undefined &&
          fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
          fields[fieldName]['component-name'] !== 'TemplatedStringField' &&
          fields[fieldName]['component-name'] !== 'RandomStyle' && (
            <Grid item sm={12} xs={12} md={4}>
              <AnnotationComponent
                key={'annotation' + fieldName + 'box'}
                fieldName={fieldName}
                field={fields[fieldName]}
                annotation={props.annotation}
                handerannoattion={props.handerannoattion}
                isclicked={isclicked}
              />
            </Grid>
          )}
      </Grid>
    </Box>
  );
}

export function ViewComponent(props: ViewProps) {
  const ui_specification = props.ui_specification;
  const viewName = props.viewName;
  const fieldNames: string[] = ui_specification.views[viewName].fields;
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
