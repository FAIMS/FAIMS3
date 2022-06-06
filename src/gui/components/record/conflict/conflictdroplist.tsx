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
import {BasicDiaglog} from './conflictDialog';
import {InitialMergeRevisionDetailsMap} from '../../../../data_storage/merging';
type ConflictDropSelectprops = {
  label: string;
  headerlist: InitialMergeRevisionDetailsMap;
  revision: string;
  index: number;
  setRevision: any;
  disablerevision: string;
  islabel?: boolean;
  isalerting?: boolean;
};

function RevisionDropList(props: ConflictDropSelectprops) {
  const {
    label,
    headerlist,
    index,
    setRevision,
    disablerevision,
    islabel,
  } = props;
  const [value, setValue] = useState(props.revision);
  const [open, setOpen] = React.useState(false);
  const [temvalue, settemvalue] = useState(props.revision);
  const isalerting = props.isalerting ?? false;

  const handleChange = (event: SelectChangeEvent) => {
    if (props.revision !== '' && isalerting === false) {
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
        <BasicDiaglog
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
            {JSON.stringify(headerlist[key]['created'])
              .replaceAll('"', '')
              .replaceAll('T', ' ')
              .slice(0, 19) +
              ' ' +
              headerlist[key]['created_by']}
          </MenuItem>
        ))}
      </Select>
    </>
  );
}

export function ConflictDropSelect(props: ConflictDropSelectprops) {
  const {
    label,
    headerlist,
    revision,
    index,
    setRevision,
    disablerevision,
  } = props;

  return (
    <Box sx={{minWidth: 400, maxWidth: 400}}>
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
    <Box sx={{minWidth: 400, maxWidth: 400}}>
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
        />
        <FormHelperText>Select a revision you wish to edit</FormHelperText>
      </FormControl>
    </Box>
  );
}
