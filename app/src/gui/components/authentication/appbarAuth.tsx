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
import {Button, Tooltip} from '@mui/material';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from '@faims3/data-model';
import {checkToken} from '../../../utils/helpers';
import {Person} from '@mui/icons-material';
import {theme} from '../../themes';

const SignInButtonComponent = () => {
  /**
    Component: SignInButtonComponent
    */
  return (
    <Button
      component={NavLink}
      to={ROUTES.SIGN_IN}
      variant="contained"
      color="primary"
      disableElevation
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: undefined,
        height: undefined,
        borderRadius: '10%',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = theme.palette.secondary.main;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = theme.palette.primary.main;
      }}
    >
      Sign In
    </Button>
  );
};

interface AuthenticatedDisplayComponentProps {
  token: TokenContents;
}
const AuthenticatedDisplayComponent = (
  props: AuthenticatedDisplayComponentProps
) => {
  /**
    Component: AuthenticatedDisplayComponent
    */

  /**
   * Extract the first initial of the username
   */
  const userInitial = props.token!.username.charAt(0).toUpperCase();
  return (
    <Button
      component={NavLink}
      to={ROUTES.SIGN_IN}
      variant="contained"
      color="primary"
      disableElevation
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '55px',
        width: '55px',
        minHeight: '55px',
        height: '55px',
        borderRadius: '50%',
        padding: '8px',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = theme.palette.secondary.main;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = theme.palette.primary.main;
      }}
    >
      <Tooltip
        title={
          <span style={{fontWeight: 'bold', fontSize: '1rem'}}>
            {props.token!.username}
          </span>
        }
        arrow
        placement="bottom"
        sx={{
          tooltip: {
            backgroundColor: theme.palette.background.lightBackground,
            color: theme.palette.text.primary,
            padding: '10px 15px',
            borderRadius: '8px',
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Person
            style={{
              fontSize: '1.25rem',
              color: theme.palette.background.paper,
            }}
          />
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '1.25rem',
              color: theme.palette.background.paper,
            }}
          >
            {userInitial}
          </span>
        </div>
      </Tooltip>
    </Button>
  );
};

interface AppBarAuthProps {
  token?: null | undefined | TokenContents;
}

export default function AppBarAuth(props: AppBarAuthProps) {
  /**
   * Show username and auth menu if authenticated, otherwise render login button
   */
  const isAuthenticated = checkToken(props.token);

  return isAuthenticated ? (
    <AuthenticatedDisplayComponent
      token={props.token!}
    ></AuthenticatedDisplayComponent>
  ) : (
    <SignInButtonComponent />
  );
}
