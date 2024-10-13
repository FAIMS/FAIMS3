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
 *   Provides a component to show either a link to sign-in or the username
 *   which links to the sign-in page
 */
import {Button} from '@mui/material';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from '@faims3/data-model';
import {checkToken} from '../../../utils/helpers';

interface AppBarAuthProps {
  token?: null | undefined | TokenContents;
}

export default function AppBarAuth(props: AppBarAuthProps) {
  /**
   * Show username and auth menu if authenticated, otherwise render login button
   */
  const isAuthenticated = checkToken(props.token);

  if (isAuthenticated) {
    return (
      <Button
        component={NavLink}
        to={ROUTES.SIGN_IN}
        variant={'outlined'}
        color={'primary'}
        disableElevation
      >
        {props.token!.username}
      </Button>
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
        Sign In
      </Button>
    );
  }
}
