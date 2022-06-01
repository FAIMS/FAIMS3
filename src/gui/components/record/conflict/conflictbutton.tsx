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
 *   TODO
 */

import React from 'react';

import {Box, Grid, Button, ButtonGroup} from '@mui/material';
import {grey} from '@mui/material/colors';
import DoneIcon from '@mui/icons-material/Done';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

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

function FieldButton(props: any) {
  return (
    <IconButton
      color="primary"
      component="span"
      onClick={() => props.onButtonClick()}
      style={{padding: '8px 0px'}}
      id={props.id}
    >
      {props.startIcon}
    </IconButton>
  );
}

export function ConflictSaveButton(props: any) {
  const onButtonDiscard = () => {
    alert('Discard');
  };
  return (
    <Grid
      item
      xs={4}
      container
      justifyContent="flex-end"
      alignItems="center"
      style={{paddingBottom: 10}}
    >
      <Button
        aria-label={''}
        onClick={onButtonDiscard}
        value={'conflictDiscard'}
        id={'conflictDiscard'}
        variant="text"
      >
        Discard
      </Button>
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
const iconstyle = {
  backgroundColor: '#1B3E93',
  color: '#fff',
  borderRadius: '2px',
};

const isclickiconstyle = {
  backgroundColor: '#fff',
  color: '#1B3E93',
  borderRadius: '2px',
};

export function FieldButtonGroup(props: any) {
  const {type, id, isclick, setFieldChanged} = props;

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
      minHeight="340px"
      maxHeight="340px"
      pt={10}
      pb={0}
    >
      <ButtonGroup>
        <FieldButton
          onButtonClick={onButtonDeleteLeft}
          startIcon={
            <DeleteOutlineIcon
              style={isclick[id] ? isclickiconstyle : iconstyle}
            />
          }
          id={id}
        />
        <FieldButton
          onButtonClick={onButtonLeft}
          startIcon={
            <DoneIcon style={isclick[id] ? isclickiconstyle : iconstyle} />
          }
          id={id}
        />
      </ButtonGroup>
    </Box>
  ) : (
    <Box
      bgcolor={grey[200]}
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      minHeight="340px"
      maxHeight="340px"
      pt={10}
      pb={0}
    >
      <ButtonGroup>
        {/* orientation="vertical" */}
        <FieldButton
          onButtonClick={onButtonRight}
          startIcon={
            <DoneIcon style={isclick[id] ? isclickiconstyle : iconstyle} />
          }
          id={id}
        />
        <FieldButton
          onButtonClick={onButtonDeleteRight}
          startIcon={
            <DeleteOutlineIcon
              style={isclick[id] ? isclickiconstyle : iconstyle}
            />
          }
          id={id}
        />
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
      minHeight="340px"
      maxHeight="340px"
      pt={10}
      pb={0}
    ></Box>
  );
}
