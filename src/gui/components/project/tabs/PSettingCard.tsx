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
 * Filename: PSettingCard.ts
 * Description:
 *   TODO: get lists from CompoenetSettings file
 *   TODO: add highlight for selected tab
 *   TODO: any type
 */

import React from 'react';
import {List, ListItem} from '@material-ui/core';
import SettingsIcon from '@material-ui/icons/Settings';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import GroupIcon from '@material-ui/icons/Group';
import NoteIcon from '@material-ui/icons/Note';
import {makeStyles} from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  settiglist: {
    // backgroundColor:'#e1e4e8',
    marginBottom: 2,
    '&$selected': {
      backgroundColor: 'red',
      '&:hover': {
        backgroundColor: 'yellow',
      },
    },
    selected: {},
  },
}));

type SettingCard = {
  handelonClick: any;
  key_id: string;
};

export function SettingCard(props: SettingCard) {
  const {handelonClick, key_id, ...other} = props;
  const classes = useStyles();

  return (
    <List
      component="nav"
      aria-label="settings bar"
      className={classes.settiglist}
    >
      <ListItem
        button
        onClick={() => handelonClick('settings', key_id)}
        key="list1"
      >
        <SettingsIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('valid', key_id)}
        key="list2"
      >
        <PlaylistAddCheckIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('access', key_id)}
        key="list3"
      >
        <GroupIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('notes', key_id)}
        key="list4"
      >
        <NoteIcon />
      </ListItem>
    </List>
  );
}
