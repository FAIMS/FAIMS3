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
 * Filename: TabTab.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Tab, Tabs, Grid} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import {useState, useEffect} from 'react';
import {AddSectionButton, EditButton} from './ProjectButton';
import {FormForm} from '../FormElement';
import {gettabform} from '../data/ComponentSetting';

function a11yProps(tabname: any, index: any) {
  return {
    id: `${tabname}-${index}`,
    'aria-controls': `${tabname}panel-${index}`,
  };
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const useStyles = makeStyles(theme => ({
  fieldtab: {
    textAlign: 'left',
    minWidth: 55,
    // backgroundColor:'#e1e4e8',
  },
  subtab: {
    // borderTop:'1px solid',
    // borderTopColor:theme.palette.primary.main
  },
  root: {},
}));

type TabProps = {
  tabs: Array<string>;
  tab_id: string;
  value: number;
  handleChange: any;
  handelonChangeLabel?: any;
};

export function TabTab(props: TabProps) {
  const classes = useStyles();
  const tabs = props.tabs;
  const tab_id = props.tab_id;
  const value = props.value;
  const handleChange = props.handleChange;
  return (
    <Tabs
      value={value}
      onChange={handleChange}
      aria-label={tab_id}
      id={tab_id}
      orientation={tab_id === 'primarytab' ? 'horizontal' : 'vertical'}
    >
      {tabs.map((tab: any, index: number) => (
        <Tab
          className={tab_id === 'primarytab' ? classes.root : classes.fieldtab}
          key={`${tab_id}-${index}`}
          label={tab}
          {...a11yProps(tab_id, index)}
        />
      ))}
    </Tabs>
  );
}

export function TabEditable(props: TabProps) {
  const classes = useStyles();
  const tabs = props.tabs;
  const tab_id = props.tab_id;
  const value = props.value;
  const handleChange = props.handleChange;
  const [tablists, setTablist] = useState<Array<any>>(tabs);
  const [isedited, setisedited] = useState(false);
  const [isset, setIsset] = useState(false);
  useEffect(() => {
    setTablist(tabs);
  }, [tabs]);

  const handleEdit = (event: any) => {
    console.debug(event);
    setisedited(true);
  };
  const handleAdd = (event: any) => {
    console.debug(event);
    const newtabs = tablists;
    const length = tablists.length + 1;
    let name = 'Section';
    if (tab_id === 'formtab') name = 'Form';
    newtabs[tablists.length] = name + length;
    setTablist(newtabs);
    props.handelonChangeLabel(newtabs, 'add');
    setIsset(!isset);
  };

  const handleSubmitForm = (values: any) => {
    const newtabs = tablists;
    Object.entries(values).map((value, index) => (newtabs[index] = value[1]));
    props.handelonChangeLabel(newtabs, 'update');
    setTablist(newtabs);
    setisedited(false);
  };

  const handleChangeForm = (event: any) => {
    console.debug(event.target.name + event.target.value);
  };

  return (
    <Grid container className={classes.subtab}>
      <Grid item sm={11} xs={12}>
        {isedited === false ? (
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label={tab_id}
            id={tab_id}
            orientation={tab_id === 'fieldtab' ? 'vertical' : 'horizontal'}
          >
            {tablists.map((tab, index) => (
              <Tab
                className={
                  tab_id === 'fieldtab' ? classes.fieldtab : classes.subtab
                }
                key={`${tab_id}-${index}`}
                label={tab}
                {...a11yProps({tab_id}, {index})}
              />
            ))}
          </Tabs>
        ) : (
          <FormForm
            uiSpec={gettabform(tabs)}
            currentView="start-view"
            handleChangeForm={handleChangeForm}
            handleSubmit={handleSubmitForm}
          />
        )}
      </Grid>
      <Grid item sm={1} xs={12}>
        {isedited === false ? (
          <>
            <EditButton
              onButtonClick={handleEdit}
              value={1}
              id="edit"
              text="X"
            />
            <AddSectionButton
              onButtonClick={handleAdd}
              value={1}
              id="add"
              text="X"
            />
          </>
        ) : (
          ''
        )}
      </Grid>
    </Grid>
  );
}
