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
 * Filename: FieldsListCard.tsx
 * Description:
 *   TODO: add style for this tab
 *   TODO: any type
 *   TODO: Field icon not working
 */

import React from 'react';
import {useState} from 'react';
import {
  Grid,
  CardActionArea,
  CardActions,
  CardContent,
  Typography,
  Card,
  Button,
} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import {getfields} from '../data/uiFieldsRegistry';

const useStyles = makeStyles(theme => ({
  content: {
    minHeight: 100,
    minWidth: 200,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  inputfieldscard: {
    backgroundColor: '#353b40',
    textAlign: 'right',
    [theme.breakpoints.down('sm')]: {
      marginBottom: 15,
      marginTop: 10,
    },
  },
  settingtab: {
    backgroundColor: '#e1e4e8',
  },
}));

function FieldCard(props: any) {
  const {className, handelonClick, fields, ...other} = props;
  return (
    <Grid container spacing={2}>
      {fields.map((field: any, index: any) => (
        <Grid
          item
          key={`${field.uiSpecProps.componentname}-${index}`}
          id={`${field.uiSpecProps.componentname}-${index}`}
          className={className}
        >
          <Card>
            <CardActionArea onClick={() => handelonClick(field.uiSpecProps)}>
              <CardContent>
                <Grid
                  container
                  spacing={2}
                  key={`${field.uiSpecProps.category}-card-${index}`}
                >
                  <Grid item sm={2} xs={12}>
                    {field.icon}
                  </Grid>
                  <Grid item sm={10} xs={12}>
                    <Typography variant="body2" component="p">
                      {field.human_readable_name}
                      <br />
                      {field.description}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default function FieldsListCard(props: any) {
  const classes = useStyles();
  const {fields, fieldtabs} = getfields();

  return (
    <>
      {fieldtabs.map((fieldtab: string, index: number) => (
        <Grid container spacing={2} key={fieldtab + index}>
          <Grid item sm={2} xs={12} className={classes.settingtab}>
            {fieldtab}
          </Grid>
          <Grid item sm={10} xs={12}>
            <FieldCard
              className={classes.content}
              handelonClick={props.cretenefield}
              fields={fields[fieldtab]}
            />
          </Grid>
        </Grid>
      ))}
    </>
  );
}
