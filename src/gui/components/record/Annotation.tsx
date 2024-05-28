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
 * Filename: Annotation.tsx
 * Description:
 *   This is the file about the Annotation Tag, which is part of Form Field, check view.tsx file
 *    - Annotation Icon , user can click to fold or unfold Annotation Field
 *    - Annotation Field(which will been unfold after user click)
 */

import React, {useState} from 'react';
import {Field} from 'formik';
import {Box} from '@mui/material';
import {getComponentByName} from '../../component_registry';

type AnnotationFieldProp = {
  fieldName: string;
  field: any;
  handleAnnotation: any;
  annotation: any;
  disabled?: boolean;
  isxs?: boolean;
  showAnnotation: boolean;
  annotationLabel: string;
  showUncertainty: boolean;
  uncertaintyLabel: string;
  // formProps:any
};

export function AnnotationField(props: AnnotationFieldProp) {
  const {fieldName, handleAnnotation} = props;
  const disabled = props.disabled ?? false; // this is disabled on conflict tab , default value is false
  const [annotation, setAnnotation] = useState(
    props.annotation !== undefined
      ? props.annotation[fieldName] !== undefined
        ? props.annotation[fieldName]['annotation']
        : ''
      : ''
  ); //props.annotation!==undefined?props.annotation[props.fieldName]['annotation']:
  const [uncertainty, setUncertainty] = useState(
    props.annotation !== undefined
      ? props.annotation[fieldName] !== undefined
        ? props.annotation[fieldName]['uncertainty']
        : true
      : true
  );
  const handlerchangesAnnotation = (event: any) => {
    const value = event.target.value;
    setAnnotation(event.target.value);
    handleAnnotation(
      event.target.name.replace('annotation', ''),
      value,
      'annotation'
    );
  };

  const handlerchangesUncertainty = (event: any) => {
    const value = !uncertainty;
    setUncertainty(value);
    handleAnnotation(
      event.target.name.replace('uncertainty', ''),
      value,
      'uncertainty'
    );
  };

  return (
    <Box>
      {props.showAnnotation && (
        <Field
          component={getComponentByName('formik-material-ui', 'TextField')} //e.g, TextField (default <input>)
          name={fieldName + 'annotation'}
          id={props.fieldName + 'annotation'}
          value={annotation}
          variant="outlined"
          onChange={handlerchangesAnnotation}
          InputProps={{type: 'text', multiline: true, minRows: 4}}
          label={props.annotationLabel}
          InputLabelProps={{shrink: true}}
          disabled={disabled}
          fullWidth
          sx={{backgroundColor: 'white'}}
        />
      )}
      {props.showUncertainty && (
        <Field
          component={getComponentByName('faims-custom', 'Checkbox')} //e.g, TextField (default <input>)
          name={props.fieldName + 'uncertainty'}
          id={props.fieldName + 'uncertainty'}
          type="checkbox"
          value={uncertainty}
          variant="outlined"
          FormControlLabelProps={{
            label: props.uncertaintyLabel,
          }}
          onChange={handlerchangesUncertainty}
          disabled={disabled}
        />
      )}
    </Box>
  );
}
