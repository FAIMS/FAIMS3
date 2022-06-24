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
 * Filename: index.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {NavLink} from 'react-router-dom';

import {
  Grid,
  Container,
  Paper,
  MenuList,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
// import AccountTree from '@mui/icons-material/AccountTree';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import WorkSharpIcon from '@mui/icons-material/WorkSharp';
import * as ROUTES from '../../constants/routes';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {TokenContents} from '../../datamodel/core';

type IndexProps = {
  token?: null | undefined | TokenContents;
};

type IndexState = {};

export class Index extends React.Component<IndexProps, IndexState> {
  constructor(props: IndexProps) {
    super(props);

    this.state = {};
  }

  render() {
    const breadcrumbs = [{title: 'Home'}];
    return (
      <Container maxWidth="lg">
        <Breadcrumbs data={breadcrumbs} token={this.props.token} />
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} lg={4}>
            <Paper>
              <MenuList>
                <MenuItem component={NavLink} to={ROUTES.SIGN_IN}>
                  <ListItemIcon>
                    <AccountBoxIcon fontSize="small" />
                  </ListItemIcon>
                  {this.props.token !== null && this.props.token !== undefined
                    ? 'Account Information'
                    : 'Sign in to notebooks'}
                </MenuItem>
              </MenuList>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} lg={4}>
            <Paper>
              <MenuList>
                <MenuItem component={NavLink} to={ROUTES.WORKSPACE}>
                  <ListItemIcon>
                    <WorkSharpIcon fontSize="small" />
                  </ListItemIcon>
                  Workspace
                </MenuItem>
                {/* <MenuItem component={NavLink} to={ROUTES.PROJECT_LIST}>
                  <ListItemIcon>
                    <AccountTree fontSize="small" />
                  </ListItemIcon>
                  Notebooks
                </MenuItem>*/}
              </MenuList>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    );
  }
}
