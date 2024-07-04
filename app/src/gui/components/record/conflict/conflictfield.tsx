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
 *   File contains element of conflict field
 *    ---- Conflict Field: Form field, Annotation with uncertainty , Updated By
 *    ---- Empty Field before data Sync to device
 *    ---- ConflictResolveIcon: shows number of conflict, unresolved , resolved and rejects
 */

import React from 'react';

import {
  Alert,
  Grid,
  Box,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  Stack,
} from '@mui/material';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import {AnnotationField} from '../Annotation';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import {card_styles, cardstyletype} from './conflictstyle';
import {CircularProgress} from '@mui/material';
import {getComponentFromFieldConfig} from '../fields';
import getLocalDate from '../../../fields/LocalDate';
import {grey} from '@mui/material/colors';
type EmptyProps = {
  isspin: boolean;
  text?: string;
  isloading?: boolean;
};
export function EmptyField(props: EmptyProps) {
  return (
    <Box p={2} style={card_styles.empty.card}>
      {props.isspin && (
        <Box>
          {props.isloading === false || props.text ? (
            <Alert severity={'info'}>
              {props.isloading === false ? (
                <span>
                  This data isn't on your device yet. It's loading, but can take
                  some time - depending on the data in conflict. You can wait,
                  or select another conflict to resolve in the meantime (the
                  conflict will continue to download in the background).
                  <CircularProgress size={16} thickness={6} />
                </span>
              ) : (
                props.text
              )}
            </Alert>
          ) : (
            ''
          )}
        </Box>
      )}
    </Box>
  );
}

type ConflictResolveIconProps = {
  numResolved: number;
  numUnResolved: number;
  num: number;
  numRejected: number;
};
export function ConflictResolveIcon(props: ConflictResolveIconProps) {
  const {numResolved, numUnResolved, num, numRejected} = props;
  return (
    <React.Fragment>
      <InfoIcon style={card_styles.conflict.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={card_styles.success.text_style}
      >
        <strong>{num} Conflicting </strong>
      </Typography>
      <InfoIcon style={card_styles.warning.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={card_styles.success.text_style}
      >
        {numUnResolved} Unresolved
      </Typography>
      <CheckBoxIcon style={card_styles.success.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={card_styles.success.text_style}
      >
        {numResolved} Resolved
      </Typography>
      <ErrorOutlineOutlinedIcon style={card_styles.delete.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={card_styles.success.text_style}
      >
        {numRejected} Rejected
      </Typography>
    </React.Fragment>
  );
}

type FieldWithAnnotationProp = {
  fieldName: string;
  fieldConfig: any;
  formProps: any;
  styletype: string;
  type?: string;
  data?: any;
  isSyncing: string;
};

export function FieldWithAnnotation(props: FieldWithAnnotationProp) {
  const {fieldName, fieldConfig, formProps, data, styletype, isSyncing} = props;
  const label =
    fieldConfig['component-parameters']['InputLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['InputLabelProps']['label']
      : fieldConfig['component-parameters']['FormLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['FormLabelProps']['children']
      : fieldConfig['component-parameters']['FormControlLabelProps'] !==
        undefined
      ? fieldConfig['component-parameters']['FormControlLabelProps']['children']
      : fieldName;

  const cardstyle: cardstyletype = card_styles[styletype];
  const annotation =
    data['fields'][fieldName] !== undefined
      ? data['fields'][fieldName]['annotations']
      : null;

  // get annotation config, backward compatible with old
  // format (DUPLICATED CODE FORM views.tsx - should be inside the annotation component)
  const annotationConfig = {
    include: false,
    label: 'Annotation',
  };
  if (fieldConfig.meta?.annotation) {
    // value could be a string (legacy) or an object
    if (typeof fieldConfig.meta.annotation !== 'object') {
      annotationConfig.include = fieldConfig.meta.annotation;
      // also label is probably set like this
      if (fieldConfig.meta.annotation_label)
        annotationConfig.label = fieldConfig.meta.annotation_label;
    } else {
      // we have a new style object spec
      annotationConfig.include = fieldConfig.meta.annotation.include || false;
      annotationConfig.label =
        fieldConfig.meta.annotation.label || 'Annotation';
    }
  }
  // uncertainty is simpler as it's always been an object
  const uncertaintyConfig = fieldConfig.meta?.uncertainty || {
    include: false,
    label: 'Uncertainty',
  };
  const show_annotation =
    annotation !== null &&
    fieldConfig.meta !== undefined &&
    fieldConfig['component-name'] !== 'BasicAutoIncrementer' &&
    fieldConfig['component-name'] !== 'TemplatedStringField' &&
    fieldConfig['component-name'] !== 'RandomStyle' &&
    fieldConfig['component-name'] !== 'RichText' &&
    (annotationConfig.include || uncertaintyConfig.include);

  return ['warning', 'delete', 'clear', 'automerge'].includes(styletype) ? (
    <Box p={2} minHeight="470px" maxHeight="470px" sx={{mt: 0}}>
      <Alert severity={styletype === 'clear' ? 'info' : 'warning'}>
        {cardstyle.text}
        {fieldName.startsWith('hrid')}
      </Alert>
      {/* Add alert message for required message */}
      {fieldConfig['component-parameters']['required'] === true &&
        styletype === 'warning' && (
          <Alert severity={'warning'}>This field is required</Alert>
        )}
    </Box>
  ) : (
    <Box px={2} pt={2} minHeight="470px" maxHeight="470px">
      <Card style={cardstyle.card}>
        {cardstyle !== null ? (
          <CardHeader
            title={label ?? fieldName}
            style={cardstyle.cardheader}
            titleTypographyProps={{noWrap: true}}
            sx={{minHeight: '54px', maxHeight: '54px', overflowX: 'scroll'}}
            action={cardstyle.icon}
          />
        ) : (
          <CardHeader
            title={label ?? fieldName}
            style={cardstyle['cardheader']}
            sx={{minHeight: '54px', maxHeight: '54px', overflowX: 'scroll'}}
          />
        )}
        <CardContent
          sx={{p: 1}}
          style={{minHeight: '340px', maxHeight: '340px', overflowY: 'scroll'}}
        >
          <Grid
            style={{
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            sx={{p: 1}}
          >
            {getComponentFromFieldConfig(
              fieldConfig,
              fieldName,
              formProps,
              isSyncing,
              true
            )}
            <br />
            <br />
            {show_annotation && (
              <AnnotationField
                key={'annotation' + fieldName + 'box'}
                fieldName={fieldName}
                field={fieldConfig}
                annotation={{
                  [fieldName]: {...annotation},
                }}
                handleAnnotation={() => {
                  console.log('annotation');
                }}
                disabled={true}
                isxs={false}
                showAnnotation={show_annotation}
                annotationLabel={annotationConfig.label}
                showUncertainty={uncertaintyConfig.include}
                uncertaintyLabel={uncertaintyConfig.label}
              />
            )}
          </Grid>
        </CardContent>
        <CardActions sx={{backgroundColor: grey[100]}}>
          <Stack direction="column" alignItems="right" justifyContent="end">
            <Typography variant="caption" color="text.secondary">
              {data['fields'][fieldName] !== undefined &&
                'Last updated by: ' + data['fields'][fieldName]['created_by']}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data['fields'][fieldName] !== undefined &&
                getLocalDate(data['fields'][fieldName]['created']).replace(
                  'T',
                  ' '
                )}
            </Typography>
          </Stack>
        </CardActions>
      </Card>
    </Box>
  );
}
