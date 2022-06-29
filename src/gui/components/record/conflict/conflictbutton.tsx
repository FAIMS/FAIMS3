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
 *   This is file contains
 *     -- Conflict buttons in Conflics section Tab, which allow user to choose reject or accept conflict field
 *     -- Conflict save button to allow user save the Conflict Resove Result or cancel
 */

import React from 'react';

import {Box, Grid, Button, ButtonGroup} from '@mui/material';
import {grey} from '@mui/material/colors';
import DoneIcon from '@mui/icons-material/Done';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {DiscardDialog} from './conflictDialog';
export function ResolveButton(props: any) {
  return (
    <Button
      variant="text"
      style={{color: '#f29c3e', paddingLeft: 0}}
      onClick={event => props.handleChange(event, '4')}
    >
      RESOLVE CONFLICTS
    </Button>
  );
}

export function FieldButton(props: any) {
  return (
    <IconButton
      color="primary"
      component="span"
      onClick={() => props.onButtonClick()}
      style={props.style}
      id={props.id}
      disabled={props.disbaled}
    >
      {props.startIcon}
    </IconButton>
  );
}

export function ConflictSaveButton(props: any) {
  return (
    <Grid
      item
      xs={4}
      container
      justifyContent="flex-end"
      alignItems="center"
      style={{paddingBottom: 10}}
    >
      <DiscardDialog
        discardconflict={props.onButtonDiscard}
        disabled={props.numResolved === 0}
      />
      <Button
        aria-label={''}
        onClick={() => props.onButtonClick(props.value)}
        value={props.value}
        id={props.id}
        startIcon={props.startIcon}
        variant="text"
        color={props.issaving ? undefined : 'primary'}
        disabled={props.issaving || props.numUnResolved !== 0}
      >
        Save
      </Button>
    </Grid>
  );
}
export const iconstyle = {
  button: {
    width: 35,
    height: 35,
    padding: '0px 5px',
    backgroundColor: '#1B3E93',
    borderRadius: '5px',
    marginBottom: '2px',
    marginRight: '2px',
  },
  icon: {
    backgroundColor: '#1B3E93',
    color: '#fff',
    borderRadius: '5px',
  },
};

// const isclickiconstyle = {
//   button: {
//     width: 35,
//     height: 35,
//     padding: '0px 5px',
//     backgroundColor: '#fff',
//     borderRadius: '2px',
//     border: '1px solid #1B3E93',
//   },
//   icon: {
//     backgroundColor: '#fff',
//     color: '#1B3E93',
//     borderRadius: '0px',
//   },
// };

// const disabediconstyle = {
//   button: {
//     width: 35,
//     height: 35,
//     padding: '0px 5px',
//     backgroundColor: '#bdbdbd',
//     borderRadius: '2px',
//     // border:'1px solid #fff'
//   },
//   icon: {
//     backgroundColor: '#bdbdbd',
//     color: '#fff',
//     borderRadius: '2px',
//   },
// };

type FieldButtonGroupProps = {
  type: string;
  id: string;
  isclick: {[key: string]: boolean};
  setFieldChanged: any;
  disbaled: {[key: string]: boolean};
};

export function FieldButtonGroup(props: FieldButtonGroupProps) {
  const {type, id, isclick, setFieldChanged, disbaled} = props;

  const onButtonDeleteLeft = () => {
    setFieldChanged(isclick[id], id, 'reject', null, null, null, true);
  };

  const onButtonDeleteRight = () => {
    setFieldChanged(isclick[id], id, null, null, 'reject', null, false);
  };

  const onButtonRight = () => {
    setFieldChanged(
      isclick[id],
      id,
      'reject',
      'success',
      'success',
      false,
      false
    );
  };

  const onButtonLeft = () => {
    setFieldChanged(
      isclick[id],
      id,
      'success',
      'success',
      'reject',
      true,
      true
    );
  };

  return type === 'left' ? (
    <Box
      bgcolor={grey[200]}
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      minHeight="470px"
      maxHeight="470px"
      pt={10}
      pb={0}
    >
      <ButtonGroup variant="contained" orientation="vertical">
        <Button
          onClick={onButtonDeleteLeft}
          size="small"
          variant={isclick[id] ? 'outlined' : 'contained'}
          disableElevation
          disabled={disbaled[id]}
        >
          <DeleteOutlineIcon />
        </Button>
        <Button
          onClick={onButtonLeft}
          size="small"
          variant={isclick[id] ? 'outlined' : 'contained'}
        >
          <DoneIcon />
        </Button>
      </ButtonGroup>
    </Box>
  ) : (
    <Box
      bgcolor={grey[200]}
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      minHeight="470px"
      maxHeight="470px"
      pt={10}
      pb={0}
      style={{borderRadius: '5px'}}
    >
      <Button
        onClick={onButtonDeleteRight}
        size="small"
        variant={isclick[id] ? 'outlined' : 'contained'}
        disableElevation
        disabled={disbaled[id]}
      >
        <DeleteOutlineIcon />
      </Button>
      <ButtonGroup variant="contained" orientation="vertical">
        {' '}
        {/*  */}
        <Button
          onClick={onButtonRight}
          size="small"
          variant={isclick[id] ? 'outlined' : 'contained'}
        >
          <DoneIcon />
        </Button>
      </ButtonGroup>
    </Box>
  );
}

export function FieldEmptyButton() {
  return (
    <Box
      bgcolor={grey[200]}
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      minHeight="470px"
      maxHeight="470px"
      pt={10}
      pb={0}
    ></Box>
  );
}
