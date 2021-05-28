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
 * Filename: index.tsx
 * Description: 
 *   TODO
 */
 
import React from 'react';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {
  Box,
  Grid,
  Container,
  Breadcrumbs,
  Typography,
  Paper,
  MenuList,
  MenuItem,
  ListItemIcon,
} from '@material-ui/core';
import AccountTree from '@material-ui/icons/AccountTree';
import HomeIcon from '@material-ui/icons/Home';
import DescriptionIcon from '@material-ui/icons/Description';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import AccountBoxIcon from '@material-ui/icons/AccountBox';
import TimelapseIcon from '@material-ui/icons/Timelapse';
type IndexProps = {
  // project: string;
};

type IndexState = {};

export class Index extends React.Component<IndexProps, IndexState> {
  constructor(props: IndexProps) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <Container maxWidth="lg">
        <Box
          display="flex"
          flexDirection="row-reverse"
          p={1}
          m={1}
          // bgcolor="background.paper"
        >
          <Breadcrumbs aria-label="breadcrumb">
            {/*<NavLink to={ROUTES.INDEX}>/</NavLink>*/}
            <Typography color="textPrimary">Index</Typography>
          </Breadcrumbs>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={6} sm={4}>
            <Paper>
              <MenuList>
                <MenuItem
                  component={NavLink}
                  to={ROUTES.SIGN_IN}
                  disabled={true}
                >
                  <ListItemIcon>
                    <AccountBoxIcon fontSize="small" />
                  </ListItemIcon>
                  Sign In <TimelapseIcon color={'secondary'} />
                </MenuItem>
                <MenuItem
                  component={NavLink}
                  to={ROUTES.SIGN_UP}
                  disabled={true}
                >
                  <ListItemIcon>
                    <PersonAddIcon fontSize="small" />
                  </ListItemIcon>
                  Sign Up <TimelapseIcon color={'secondary'} />
                </MenuItem>
                <MenuItem
                  component={NavLink}
                  to={ROUTES.FORGOT_PASSWORD}
                  disabled={true}
                >
                  <ListItemIcon>
                    <LockOpenIcon fontSize="small" />
                  </ListItemIcon>
                  Forgot Password <TimelapseIcon color={'secondary'} />
                </MenuItem>
              </MenuList>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Paper>
              <MenuList>
                <MenuItem component={NavLink} to={ROUTES.HOME}>
                  <ListItemIcon>
                    <HomeIcon fontSize="small" />
                  </ListItemIcon>
                  Home
                </MenuItem>
                <MenuItem component={NavLink} to={ROUTES.PROJECT_LIST}>
                  <ListItemIcon>
                    <AccountTree fontSize="small" />
                  </ListItemIcon>
                  Projects
                </MenuItem>
                <MenuItem component={NavLink} to={ROUTES.OBSERVATION_LIST}>
                  <ListItemIcon>
                    <DescriptionIcon fontSize="small" />
                  </ListItemIcon>
                  Observations
                </MenuItem>
              </MenuList>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    );
  }
}
