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
 *   TODO
 */
import * as React from 'react';
import {useState} from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import {Typography} from '@mui/material';

type ConflictDropSelectprops = {
  label: string;
  headerlist: Array<string>;
  revision: string;
  index: number;
  setRevision: any;
  disablerevision: string;
  islabel?: boolean;
};

function RevisionDropList(props: ConflictDropSelectprops) {
  const {
    label,
    headerlist,
    revision,
    index,
    setRevision,
    disablerevision,
    islabel,
  } = props;
  const [value, setValue] = useState(revision);

  const handleChange = (event: SelectChangeEvent) => {
    setRevision(event.target.value as string, index);
    setValue(event.target.value as string);
  };

  return (
    <Select
      labelId={'Conflictselect' + label}
      id={'Conflictselect' + label}
      label={islabel ? 'Conflict ' + label : ''}
      value={value}
      onChange={handleChange}
      displayEmpty
    >
      {headerlist.map((value: string) => (
        <MenuItem value={value} disabled={value === disablerevision}>
          {value}
        </MenuItem>
      ))}
    </Select>
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
        />
        <FormHelperText>Select a revision you wish to edit</FormHelperText>
      </FormControl>
    </Box>
  );
}