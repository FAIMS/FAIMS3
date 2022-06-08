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
 * Filename: Annotatio.tsx
 * Description:
 *   This is the file about the Annoation Tag, which is part of Form Field, check view.tsx file
 *    - Annottaion Icon , user can click to fold or unfold Annotation Field
 *    - Annotation Field(which will been unfold after user click)
 */

import React, {useEffect, useState} from 'react';
import {Field} from 'formik';
import {IconButton, Box} from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';

import {UpButton, DownButton} from '../project/tabs/ProjectButton';
import {getComponentByName} from '../../component_registry';
import {Grid} from '@mui/material';
/* eslint-disable @typescript-eslint/no-unused-vars */
export function Annotation(props: any) {
  const {field, isclicked, setIsClick} = props;
  const [subisclicked, setIsclicks] = useState(false);

  useEffect(() => {
    let isactive = true;
    if (isactive) {
      setIsClick(false);
    }
    return () => {
      isactive = false;
    };
  }, []);

  return (field.meta !== undefined && field.meta.annotation !== false) ||
    (field.meta !== undefined &&
      field.meta.uncertainty !== undefined &&
      field.meta.uncertainty.include !== false) ? (
    <Box
      display="flex"
      justifyContent="flex-start"
      alignItems="center"
      className="Button"
      sx={{
        width: 80,
        height: 32,
        borderRadius: '30px',
        backgroundColor: '#e8f4fd',
        boxShadow: 3,
      }}
    >
      <IconButton
        edge="end"
        onClick={() => {
          const isc = !subisclicked;
          setIsClick(isc);
          setIsclicks(isc);
        }}
        size="small"
        // style={{paddingLeft:0,paddingRight:0}}
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
    </Box>
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
  disabled?: boolean;
  isxs?: boolean;
  // formProps:any
};

export function AnnotationField(props: AnnotationFieldProp) {
  const {field, fieldName, handerannoattion, isclicked} = props;
  const disabled = props.disabled ?? false; // this is diabled on conflcit tab , ddefault value is false
  const isxs = props.isxs ?? true; // this is enabled on conflcit tab , ddefault value is true
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

  const isannotationshow =
    isclicked && field.meta !== undefined && field.meta.annotation !== false;
  const isuncertityshow =
    field.meta !== undefined &&
    field.meta['uncertainty'] !== undefined &&
    field['meta']['uncertainty']['include'] &&
    isclicked;
  return (
    <Grid container>
      {isannotationshow && (
        <Grid
          item
          sm={isannotationshow && isxs ? 8 : 12}
          xs={12}
          style={{padding: '15px 0px'}}
        >
          <Field
            component={getComponentByName('formik-material-ui', 'TextField')} //e.g, TextField (default <input>)
            name={fieldName + 'annotation'}
            id={props.fieldName + 'annotation'}
            value={annotation}
            variant="outlined"
            onChange={handlerchangesAnnotation}
            InputProps={{type: 'text'}}
            label={field['meta']['annotation_label']}
            InputLabelProps={{shrink: true}}
            disabled={disabled}
            fullWidth
          />
        </Grid>
      )}
      {isuncertityshow && (
        <Grid
          item
          sm={isannotationshow && isxs ? 4 : 12}
          xs={12}
          style={{padding: '15px 0px'}}
        >
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
            disabled={disabled}
          />
        </Grid>
      )}
      <br />
    </Grid>
  );
}
