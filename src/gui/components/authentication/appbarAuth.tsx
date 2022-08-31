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
import {Button, Typography} from '@mui/material';

import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from '../../../datamodel/core';
import {tokenExists} from '../../../utils/helpers';
interface AppBarAuthProps {
  token?: null | undefined | TokenContents;
}
export default function AppBarAuth(props: AppBarAuthProps) {
  const isAuthenticated = tokenExists(props.token);
  return (
    <React.Fragment>
      {isAuthenticated ? (
        <Typography>{props.token?.username}</Typography>
      ) : (
        <Button
          component={NavLink}
          to={ROUTES.SIGN_IN}
          variant={'contained'}
          color={'primary'}
          disableElevation
        >
          Login
        </Button>
      )}
    </React.Fragment>
  );
}
