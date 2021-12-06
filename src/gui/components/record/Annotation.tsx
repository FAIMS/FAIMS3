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
 * Filename: Annotatio.tsx
 * Description:
 *   TODO
 */

import React, {useEffect, useState} from 'react';
import {Field} from 'formik';
import {IconButton} from '@material-ui/core';
import NoteIcon from '@material-ui/icons/Note';

import {UpButton, DownButton} from '../project/tabs/ProjectButton';
import {getComponentByName} from '../../component_registry';

/* eslint-disable @typescript-eslint/no-unused-vars */
export function Annotation(props: any) {
  const {field, isclicked, setIsClick} = props;
  const [subisclicked, setIsclicks] = useState(false);

  useEffect(() => {
    setIsClick(false);
  }, []);

  return field.meta !== undefined && field.meta.annotation !== false ? (
    <>
      <IconButton
        edge="end"
        onClick={() => {
          const isc = !subisclicked;
          setIsClick(isc);
          setIsclicks(isc);
        }}
      >
        <NoteIcon fontSize="small" />
      </IconButton>

      {subisclicked ? (
        <UpButton
          onButtonClick={() => {
            setIsClick(false);
            setIsclicks(false);
          }}
          value={1}
          id={1}
        />
      ) : (
        <DownButton
          onButtonClick={() => {
            setIsClick(true);
            setIsclicks(true);
          }}
          value={0}
          id={0}
        />
      )}
      <br />
    </>
  ) : (
    <></>
  );
}

type AnnotationFieldProp = {
  isclicked: boolean;
  fieldName: string;
  field: any;
  handerannoattion: any;
  annotation: any;
  // formProps:any
};

export function AnnotationField(props: AnnotationFieldProp) {
  const {field, fieldName, handerannoattion, isclicked} = props;
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
    handerannoattion(
      event.target.name.replace('annotation', ''),
      value,
      'annotation'
    );
  };

  const handlerchangesUncertainty = (event: any) => {
    const value = !uncertainty;
    setUncertainty(value);
    handerannoattion(
      event.target.name.replace('uncertainty', ''),
      value,
      'uncertainty'
    );
  };
  return (
    <>
      {isclicked && (
        <Field
          component={getComponentByName('formik-material-ui', 'TextField')} //e.g, TextField (default <input>)
          name={fieldName + 'annotation'}
          id={props.fieldName + 'annotation'}
          value={annotation}
          variant="outlined"
          onChange={handlerchangesAnnotation}
          InputProps={{type: 'text'}}
          label={field['meta']['annotation_label']}
        />
      )}
      {field.meta!==undefined&&field.meta['uncertainty'] !== undefined &&
        !field['meta']['uncertainty']['include'] &&
        isclicked && (
          <Field
            component={getComponentByName('faims-custom', 'Checkbox')} //e.g, TextField (default <input>)
            name={props.fieldName + 'uncertainty'}
            id={props.fieldName + 'uncertainty'}
            type="checkbox"
            value={uncertainty}
            variant="outlined"
            FormControlLabelProps={{
              label: field['meta']['uncertainty']['label'],
            }}
            onChange={handlerchangesUncertainty}
          />
        )}
    </>
  );
}
