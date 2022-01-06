/*
 * Copyright 2021,2022 Macquarie University
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
 */

import React, {useEffect, useState} from 'react';
import {FormikProps} from 'formik';
import Alert from '@material-ui/lab/Alert';
import {ProjectUIModel} from '../../../datamodel/ui';
import RecordDraftState from '../../../sync/draft-state';
import {getComponentFromFieldConfig} from './fields';
import {Annotation, AnnotationField} from './Annotation';
import {Grid} from '@material-ui/core';
type ViewProps = {
  viewName: string;
  ui_specification: ProjectUIModel;
  formProps: FormikProps<{[key: string]: unknown}>;
  draftState: RecordDraftState;
  annotation: any;
  handerannoattion: any;
};

function SingleComponent(props: any) {
  const fieldName = props.fieldName;
  const fields = props.fields;
  const [isclicked, setIsClick] = useState(false);

  return (
    <Grid container>
      <Grid item sm={10} xs={12}>
        {getComponentFromFieldConfig(
          fields[fieldName],
          fieldName,
          props.formProps
        )}
      </Grid>
      <Grid item sm={2} xs={12} style={{marginTop: '0.5em'}}>
        {props.annotation !== undefined &&
          fields[fieldName].meta !== undefined &&
          fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
          fields[fieldName]['component-name'] !== 'TemplatedStringField' && (
            <Annotation
              key={'annotation' + fieldName + 'box'}
              setIsClick={setIsClick}
              isclicked={isclicked}
              field={fields[fieldName]}
            />
          )}
      </Grid>
      {props.annotation !== undefined &&
        fields[fieldName].meta !== undefined &&
        fields[fieldName]['component-name'] !== 'BasicAutoIncrementer' &&
        fields[fieldName]['component-name'] !== 'TemplatedStringField' && (
          <Grid item sm={12} xs={12} style={{margin: '0 0 1em 0'}}>
            <AnnotationField
              key={'annotation' + fieldName + 'box'}
              fieldName={fieldName}
              // formProps={this.props.formProps}
              field={fields[fieldName]}
              annotation={props.annotation}
              handerannoattion={props.handerannoattion}
              isclicked={isclicked}
            />
          </Grid>
        )}
    </Grid>
  );
}

export function ViewComponent(props: ViewProps) {
  const ui_specification = props.ui_specification;
  const viewName = props.viewName;
  const fieldNames: string[] = ui_specification.views[viewName].fields;
  const fields = ui_specification.fields;
  const [error, setError] = useState(true);

  useEffect(() => {
    let iserror = false;
    fieldNames.map(field =>
      props.formProps.errors[field] !== undefined ? (iserror = true) : field
    );
    setError(iserror);
  }, [props.formProps]);

  return (
    <React.Fragment>
      {fieldNames.map(fieldName => (
        <SingleComponent
          fieldName={fieldName}
          fields={fields}
          formProps={props.formProps}
          draftState={props.draftState}
          annotation={props.annotation}
          handerannoattion={props.handerannoattion}
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
