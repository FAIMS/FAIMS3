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
 * Filename: appbarAuth.tsx
 * Description:
 *   This contains the navbar React component, which allows users to navigate
 *   throughout the app.
 */
import React from 'react';
import {Button, Menu, MenuItem} from '@mui/material';
import {useHistory} from 'react-router-dom';

import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from '../../../datamodel/core';
import {checkToken} from '../../../utils/helpers';

interface AppBarAuthProps {
  token?: null | undefined | TokenContents;
}

export default function AppBarAuth(props: AppBarAuthProps) {
  /**
   * Show username and auth menu if authenticated, otherwise render login button
   */
  const isAuthenticated = checkToken(props.token);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const history = useHistory();
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRoutingAndClose = (route: string) => {
    handleClose();
    history.push(route);
  };

  if (isAuthenticated) {
    return (
      <React.Fragment>
        <Button
          size="large"
          aria-label="account of current user"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={handleMenu}
          color="inherit"
        >
          {props.token?.username}
        </Button>
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={() => handleRoutingAndClose(ROUTES.WORKSPACE)}>
            Workspace
          </MenuItem>
          <MenuItem onClick={() => handleRoutingAndClose(ROUTES.SIGN_IN)}>
            Switch User
          </MenuItem>
          <MenuItem onClick={() => handleRoutingAndClose(ROUTES.SIGN_IN)}>
            Logout {props.token!.username}
          </MenuItem>
        </Menu>
      </React.Fragment>
    );
  } else {
    return (
      <Button
        component={NavLink}
        to={ROUTES.SIGN_IN}
        variant={'contained'}
        color={'primary'}
        disableElevation
      >
        Login
      </Button>
    );
  }
}
