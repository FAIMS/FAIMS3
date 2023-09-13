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
 * Filename: PSettingCard.ts
 * Description:
 *   TODO: get lists from ComponentSettings file
 *   TODO: add highlight for selected tab
 *   TODO: any type
 */

import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Paper,
  Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import GroupIcon from '@mui/icons-material/Group';
import NoteIcon from '@mui/icons-material/Note';
import AccountTree from '@mui/icons-material/AccountTree';
// import makeStyles from '@mui/styles/makeStyles';
import {createUseStyles as makeStyles} from 'react-jss';
import {getconnections} from '../data/ComponentSetting';
// import NoteIcon from '@mui/icons-material/NoteIcon';
import {DeleteuserButton} from './ProjectButton';
import NextWeekIcon from '@mui/icons-material/NextWeek';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TaskIcon from '@mui/icons-material/Task';
/* eslint-disable @typescript-eslint/no-unused-vars */
const useStyles = makeStyles((theme: any) => ({
  settingList: {
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
  formconnection: {},
  userrole: {
    maxWidth: 300,
    minHeight: 150,
  },
}));

type SettingCard = {
  handelonClick: any;
  key_id: string;
  selected: string;
};

export function SettingCard(props: SettingCard) {
  const {handelonClick, key_id, selected, ...other} = props;
  const classes = useStyles();

  return (
    <List
      component="nav"
      aria-label="settings bar"
      className={classes.settingList}
    >
      <ListItem
        button
        onClick={() => handelonClick('settings', key_id)}
        key="list1"
        selected={selected === 'settings'}
      >
        <SettingsIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('valid', key_id)}
        key="list2"
        selected={selected === 'valid'}
      >
        <PlaylistAddCheckIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('access', key_id)}
        key="list3"
        selected={selected === 'access'}
      >
        <GroupIcon />
      </ListItem>
      <ListItem
        button
        onClick={() => handelonClick('notes', key_id)}
        key="list4"
        selected={selected === 'notes'}
      >
        <NoteIcon />
      </ListItem>
      {/* add for branching logic setting, this is for testing/developing ONLY, not ready for production yet */}
      {String(import.meta.env.VITE_SERVER) === 'developer' && (
        <ListItem
          button
          onClick={() => handelonClick('logic', key_id)}
          key="list5"
          selected={selected === 'logic'}
        >
          <TaskIcon />
        </ListItem>
      )}
    </List>
  );
}

export function FormConnectionCard(props: any) {
  const classes = useStyles();
  const tabs = props.tabs.filter((tab: string) => tab !== props.tabname);
  const linkedtabs = getconnections(props.form, props.formuiSpec, tabs);
  return (
    <List
      component="nav"
      aria-label="settings bar"
      className={classes.formconnection}
    >
      {props.tabname} Linked to
      {linkedtabs.map((tab: {tab: string; link: string}) => (
        <ListItem key={props.tabname + tab.tab + 'relationlist'}>
          <ListItemIcon>
            {tab.link === 'Child' ? <AccountTree /> : <NextWeekIcon />}
          </ListItemIcon>
          <ListItemText primary={tab.tab} secondary={tab.link} />
        </ListItem>
      ))}
    </List>
  );
}

export function UserRoleList(props: any) {
  const classes = useStyles();
  const {users, deleteuserrole, ...others} = props;
  const defaultuser = ['admin', 'moderator', 'team', 'admin@gmail.com'];
  return (
    <Paper className={classes.userrole}>
      <List component="nav" aria-label="user bar" className={classes.userrole}>
        {users.map((user: string, index: number) => (
          <>
            <ListItem key={user + index} id={`list-user-${user + index}`}>
              <ListItemText secondary={user} />
              {defaultuser.includes(user) || props.delete === false ? (
                ''
              ) : (
                <ListItemSecondaryAction>
                  <DeleteuserButton
                    id={`list-delete-${user}`}
                    onButtonClick={deleteuserrole}
                    value={user}
                  />
                </ListItemSecondaryAction>
              )}
            </ListItem>
            <Divider key={user + index + 'divider'} />
          </>
        ))}
      </List>
    </Paper>
  );
}

export function UserLists(props: any) {
  const classes = useStyles();
  const {users, handelonClick, usergroup, select, ...others} = props;
  return (
    <Paper className={classes.userrole}>
      <List component="nav" aria-label="user bar" className={classes.userrole}>
        {users.map((user: string, index: number) => (
          <>
            <ListItem
              key={`user-${user + index}`}
              id={`user-${user + index}`}
              button
              onClick={() => handelonClick(user, usergroup, select)}
            >
              <ListItemText secondary={user} />
              {select ? <AddIcon /> : <DeleteIcon />}
            </ListItem>
            <Divider key={user + index + 'divider'} />
          </>
        ))}
      </List>
    </Paper>
  );
}
