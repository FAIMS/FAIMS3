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
 * Filename: conflictdroplist.tsx
 * Description:
 *   File about Revision Droplist, user can choose revision to resolve or edit from droplist
 */
import * as React from 'react';
import {useState} from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import {Typography} from '@mui/material';
import {BasicDialog} from './conflictDialog';
import {InitialMergeRevisionDetailsMap} from 'faims3-datamodel';
import getLocalDate from '../../../fields/LocalDate';
type ConflictDropSelectprops = {
  label: string;
  headerlist: InitialMergeRevisionDetailsMap;
  revision: string;
  index: number;
  setRevision: any;
  disablerevision: string;
  islabel?: boolean;
  isalerting?: boolean;
  numResolved?: number;
};

function RevisionDropList(props: ConflictDropSelectprops) {
  const {label, headerlist, index, setRevision, disablerevision, islabel} =
    props;
  let inivalue = props.revision; // this is the default value for droplist
  if (!Object.keys(headerlist).includes(props.revision) && inivalue !== '') {
    if (index === 1) inivalue = '';
    else inivalue = Object.keys(headerlist)[0]; //if value is out of range, set the first one as default one and reset the conflict
    setRevision(inivalue, index);
  }
  if (inivalue === '' && index === 0) {
    inivalue = Object.keys(headerlist)[0];
    setRevision(inivalue, index);
  }
  const [value, setValue] = useState(inivalue);
  const [open, setOpen] = React.useState(false);
  const [temvalue, settemvalue] = useState(inivalue);
  const isalerting = props.isalerting ?? false;
  const isalert = props.numResolved !== 0 ? true : false;

  const handleChange = (event: SelectChangeEvent) => {
    console.log(event.target);
    if (event.target.value === '') {
      return;
    }
    if (props.revision !== '' && isalerting === false && isalert) {
      settemvalue(event.target.value as string);
      setOpen(true);
    } else {
      setRevision(event.target.value as string, index);
      setValue(event.target.value as string);
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
    settemvalue(value);
  };

  const handleConfirm = () => {
    setOpen(false);
    setRevision(temvalue, index);
    setValue(temvalue);
  };

  return (
    <>
      <Grid>
        <BasicDialog
          handleClose={handleClose}
          handleOpen={handleOpen}
          handleConfirm={handleConfirm}
          content={
            'If you change the conflict revision, any changes made here will be lost. Proceed?'
          }
          continue={'Continue'}
          cancel={'Cancel'}
          open={open}
        />
      </Grid>
      <Select
        labelId={'Conflictselect' + label}
        id={'Conflictselect' + label}
        label={islabel ? 'Conflict ' + label : ''}
        value={value}
        onChange={handleChange}
        displayEmpty
      >
        {Object.keys(headerlist).map((key: string) => (
          <MenuItem value={key} disabled={key === disablerevision}>
            {getLocalDate(headerlist[key]['created']).replace('T', ' ') +
              ' ' +
              headerlist[key]['created_by']}
          </MenuItem>
        ))}
      </Select>
    </>
  );
}

export function ConflictDropSelect(props: ConflictDropSelectprops) {
  const {label, headerlist, revision, index, setRevision, disablerevision} =
    props;

  return (
    <Box sx={{minWidth: 200, maxWidth: 400}}>
      <FormControl fullWidth>
        <InputLabel htmlFor={'Conflictselect' + label}>
          {'Conflict ' + label}
        </InputLabel>
        <RevisionDropList
          label={label}
          headerlist={headerlist}
          revision={revision}
          index={index}
          setRevision={setRevision}
          disablerevision={disablerevision}
          islabel={true}
          numResolved={props.numResolved}
        />
        <FormHelperText>Select a conflict to resolve</FormHelperText>
      </FormControl>
    </Box>
  );
}

export function EditDroplist(props: ConflictDropSelectprops) {
  const {
    label,
    headerlist,
    revision,
    index,
    setRevision,
    disablerevision,
    isalerting,
  } = props;

  return (
    <Box sx={{minWidth: 200, maxWidth: 400}}>
      <FormControl fullWidth>
        <Typography variant="h6" display="block">
          Currently editing version:
        </Typography>
        <RevisionDropList
          label={label}
          headerlist={headerlist}
          revision={revision}
          index={index}
          setRevision={setRevision}
          disablerevision={disablerevision}
          islabel={false}
          isalerting={isalerting}
          numResolved={1}
        />
        <FormHelperText>Select a revision you wish to edit</FormHelperText>
      </FormControl>
    </Box>
  );
}
