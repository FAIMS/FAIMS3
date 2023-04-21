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
 * Filename: FormElement.tsx
 * Description: This is the file for formelemnets for Notebook Creation, not contain any information about handler(check other files)
 *   TODO: any type
 *   TODO: different design settings
 */

import React from 'react';
import {useState, useEffect} from 'react';
import {
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  IconButton,
  Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {
  getDisplayStatusForProject,
  UserFriendlyAutoincrementStatus,
} from '../../../local-data/autoincrement';

export default function RangeHeader(props: {
  project: any;
  handleAIEdit: Function;
}) {
  const [status, setStatus] = useState<UserFriendlyAutoincrementStatus[]>();

  useEffect(() => {
    let isactive = true;
    if (isactive) {
      getDisplayStatusForProject(props.project.project_id).then(res =>
        setStatus(res)
      );

      console.debug('Updating ranges for', props.project.project_id);
    }
    return () => {
      isactive = false;
    };
  }, [props.project.project_id]);

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      variant={'outlined'}
      sx={{maxHeight: '80vh', overflowY: 'scroll'}}
    >
      <Typography variant={'h6'} sx={{m: 2}} gutterBottom>
        Range Indices
      </Typography>
      <Table size={'small'}>
        <TableHead>
          <TableRow>
            <TableCell>
              <Typography variant={'overline'}>Index</Typography>
            </TableCell>
            <TableCell>
              <Typography variant={'overline'}>Last Used</Typography>
            </TableCell>
            <TableCell>
              <Typography variant={'overline'}>Range End</Typography>
            </TableCell>
            <TableCell>
              <Typography variant={'overline'}>Edit</Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {status?.map((sta, index) => (
            <TableRow key={index}>
              <TableCell>{sta.label}</TableCell>
              <TableCell>{sta.last_used}</TableCell>
              <TableCell>{sta.end}</TableCell>
              <TableCell>
                <IconButton
                  onClick={e => props.handleAIEdit(e, 1)}
                  size={'small'}
                >
                  <EditIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {status !== undefined && status.length > 0 ? (
        ''
      ) : (
        <Alert severity={'info'}>No range indices defined</Alert>
      )}
    </TableContainer>
  );
}
