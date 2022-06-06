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
 *    ---- Conflict Field: Form field, Annoation with uncertiy , Updated By
 *    ---- Empty Field before data Sync to device
 *    ---- ConflictResolveIcon: shows number of conflict, unresolved , resolved and rejects
 */

import React from 'react';

import {
  Grid,
  Box,
  Card,
  CardHeader,
  CardContent,
  IconButton,
  Typography,
} from '@mui/material';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import {AnnotationField} from '../Annotation';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import {cardsstyles, cardstyletype} from './conflictstyle';
import {CircularProgress} from '@mui/material';
import {getComponentFromFieldConfig} from '../fields';
type FieldWithAnnotationProp = {
  fieldName: string;
  fieldConfig: any;
  formProps: any;
  styletype: string;
  type?: string;
  data?: any;
};

type EmptyProps = {
  isspin: boolean;
  text?: string;
  isloading?: boolean;
};
export function EmptyField(props: EmptyProps) {
  return (
    <Box pt={10} px={3} style={cardsstyles.empty.card}>
      {props.isspin && (
        <Grid
          container
          justifyContent="center"
          alignItems="center"
          style={cardsstyles.empty.cardheader}
        >
          <Grid
            item
            xs={2}
            container
            justifyContent="center"
            alignItems="flex-start"
          >
            {props.isloading === false ? (
              <CircularProgress size={12} thickness={4} />
            ) : (
              <InfoOutlinedIcon style={cardsstyles.empty.iconstyle} />
            )}
          </Grid>

          <Grid item xs={10}>
            <Typography variant="caption" display="block">
              {props.isloading === false
                ? " This data isn't on your device yet. It's loading,it might take some time. You can wait or select another conflict to resolve in the meantime. "
                : props.text}
            </Typography>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

type ConflictResolveIconProps = {
  numResolved: number;
  numUnResolved: number;
  num: number;
};
export function ConflictResolveIcon(props: ConflictResolveIconProps) {
  const {numResolved, numUnResolved, num} = props;
  return (
    <Grid
      item
      xs={8}
      container
      justifyContent="flex-start"
      alignItems="center"
      style={{paddingBottom: 10, paddingLeft: 10}}
    >
      <InfoIcon style={cardsstyles.conflict.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={cardsstyles.success.textstyle}
      >
        <strong>{num} Conflicting </strong>
      </Typography>
      <InfoIcon style={cardsstyles.warning.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={cardsstyles.success.textstyle}
      >
        {numUnResolved} UnResolved
      </Typography>
      <CheckBoxIcon style={cardsstyles.success.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={cardsstyles.success.textstyle}
      >
        {numResolved} Resoved
      </Typography>
      <ErrorOutlineOutlinedIcon style={cardsstyles.delete.iconstyle} />
      <Typography
        variant="caption"
        display="block"
        style={cardsstyles.delete.textstyle}
      >
        {numResolved} Rejected
      </Typography>
    </Grid>
  );
}

export function FieldWithAnnotation(props: FieldWithAnnotationProp) {
  const {fieldName, fieldConfig, formProps, data, styletype} = props;
  const label =
    fieldConfig['component-parameters']['InputLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['InputLabelProps']['label']
      : fieldConfig['component-parameters']['FormLabelProps'] !== undefined
      ? fieldConfig['component-parameters']['FormLabelProps']['children']
      : fieldConfig['component-parameters']['FormControlLabelProps'] !==
        undefined
      ? fieldConfig['component-parameters']['FormControlLabelProps']['children']
      : fieldName;

  const cardstyle: cardstyletype = cardsstyles[styletype];
  const annoataion =
    data['fields'][fieldName] !== undefined
      ? data['fields'][fieldName]['annotations']
      : null;

  return ['warning', 'delete', 'clear'].includes(styletype) ? (
    <Box pt={10} pl={3} pr={3} minHeight="340px" maxHeight="340px">
      <Grid
        container
        justifyContent="flex-start"
        alignItems="center"
        style={cardstyle.cardheader}
      >
        {cardstyle.icon}
        <Typography variant="caption" display="block">
          {cardstyle.text}
        </Typography>
      </Grid>
    </Box>
  ) : (
    <Box pt={10} px={3}>
      <Card style={cardstyle.card}>
        {cardstyle !== null ? (
          <CardHeader
            title={label ?? fieldName}
            style={cardstyle.cardheader}
            action={
              <IconButton sx={{color: 'white'}}>{cardstyle.icon}</IconButton>
            }
          />
        ) : (
          <CardHeader
            title={label ?? fieldName}
            style={cardstyle['cardheader']}
          />
        )}
        <CardContent style={cardstyle.cardcotent}>
          <Grid style={{minHeight: '225px'}}>
            <Typography variant="body2" color="text.secondary"></Typography>
            {getComponentFromFieldConfig(
              fieldConfig,
              fieldName,
              formProps,
              true
            )}
            <br />
            <br />
            {fieldConfig['meta'] !== undefined &&
              fieldConfig['meta']['annotation'] !== undefined &&
              fieldConfig['meta']['annotation'] === true &&
              annoataion !== null && (
                <AnnotationField
                  key={'annotation' + fieldName + 'box'}
                  fieldName={fieldName}
                  // formProps={this.props.formProps}
                  field={fieldConfig}
                  annotation={{
                    [fieldName]: {...annoataion},
                  }}
                  handerannoattion={() => {
                    console.log('annotation');
                  }}
                  isclicked={true}
                  disabled={true}
                  isxs={false}
                />
              )}
          </Grid>
          <Grid
            style={{display: 'block', paddingLeft: 1}}
            container
            justifyContent="flex-end"
            alignItems="flex-end"
          >
            <Typography variant="caption" color="text.secondary">
              Last Updated By {data['fields'][fieldName]['created_by']}
              {JSON.stringify(data['fields'][fieldName]['created'])
                .replaceAll('"', '')
                .replaceAll('T', ' ')
                .slice(0, 19)}
            </Typography>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
