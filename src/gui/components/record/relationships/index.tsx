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
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';

import {Alert, Box, Divider, Grid, Paper, Typography} from '@mui/material';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

import {RelationshipsComponentProps} from './types';

import RecordLinkComponent from './record_links';
import BoxTab from '../../ui/boxTab';
import {grey} from '@mui/material/colors';

import DataGridLinksComponent from './link_datagrid';
import FieldRelationshipComponent from './field_relationships';
import LinkIcon from '@mui/icons-material/Link';

export default function RelationshipsViewComponent(
  props: RelationshipsComponentProps
) {
  /**
   * Display the parent, child and related records associated with the current record
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
   *
   *
   */
  return (
    <Box mb={2}>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Grid
            container
            spacing={1}
            justifyContent={'center'}
            alignItems={'flex-start'}
          >
            <Grid item>
              <LinkIcon fontSize={'inherit'} sx={{mt: '3px'}} />
            </Grid>
            <Grid item>
              <Typography variant={'h6'}>Links to this record</Typography>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs>
          {/*<Divider />*/}
        </Grid>
      </Grid>
      <Box component={Paper} elevation={0} mb={2}>
        <RecordLinkComponent record_links={props.related_records}  is_field={false}/>
      </Box>

      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Grid
            container
            spacing={1}
            justifyContent={'center'}
            alignItems={'flex-start'}
          >
            <Grid item>
              <LinkIcon fontSize={'inherit'} sx={{mt: '3px'}} />
            </Grid>
            <Grid item>
              <Typography variant={'h6'}>Links to fields within this record</Typography>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs>
          {/*<Divider />*/}
        </Grid>
      </Grid>
      <Box component={Paper} elevation={0} mb={2}>
        <RecordLinkComponent record_links={props.new_related_links} is_field={true}/>
      </Box>
      <Alert severity={'info'}>
        To add/remove a link, go to the record &gt; field and edit directly.
      </Alert>
      <BoxTab
        title={'Field-level links widget (to be moved)'}
        bgcolor={grey[100]}
      />
      <Box bgcolor={grey[100]} p={2} component={Paper} variant={'outlined'}>
        <FieldRelationshipComponent
          child_links={props.child_links}
          related_links={props.related_links}
          record_hrid={props.record_hrid}
          record_type={props.record_type}
          field_label={'FIELD: PH'}
        />
      </Box>
    </Box>
  );
}
