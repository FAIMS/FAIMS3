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
 * Filename: TabPanel.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
// import makeStyles from '@mui/styles/makeStyles';
import {createUseStyles} from 'react-jss';

const useStyles = createUseStyles((theme: any) => ({
  TabPanel_F: {
    paddingTop: 5,

    [theme.breakpoints.down('md')]: {
      paddingLeft: 5,
      paddingRight: 5,
    },
    '& .MuiBox-root': {
      paddingTop: 10,
      paddingLeft: 5,
      paddingRight: 0,
      [theme.breakpoints.down('md')]: {
        paddingLeft: 5,
        paddingRight: 5,
      },
    },
    '& .MuiTabs': {
      paddingBottom: 10,
    },
  },
}));

type TabPanelProps = {
  children: any;
  value: number;
  tabname: string;
  index: number;
};
export default function TabPanel(props: TabPanelProps) {
  const {children, value, tabname, index, ...other} = props;
  const classes = useStyles();

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`${tabname}panel-${index}`}
      aria-labelledby={`${tabname}-${index}`}
      {...other}
      className={classes.TabPanel_F}
    >
      {value === index && (
        <Box p={3}>
          <Typography component={'span'}>{children}</Typography>
        </Box>
      )}
    </div>
  );
}
