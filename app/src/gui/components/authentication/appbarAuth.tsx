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
import {Button, useMediaQuery} from '@mui/material';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from '@faims3/data-model';
import {checkToken} from '../../../utils/helpers';
import {Person} from '@mui/icons-material';
import {theme} from '../../themes';

interface AppBarAuthProps {
  token?: null | undefined | TokenContents;
}

export default function AppBarAuth(props: AppBarAuthProps) {
  /**
   * Show username and auth menu if authenticated, otherwise render login button
   */
  const isAuthenticated = checkToken(props.token);

  /**
   * Determines if the screen width is 768px or wider (desktop view).
   */
  const isDesktop = useMediaQuery('(min-width:768px)');

  return (
    <Button
      component={NavLink}
      to={ROUTES.SIGN_IN}
      variant={'contained'}
      color={'primary'}
      startIcon={<Person style={{color: theme.palette.background.default}} />}
      disableElevation
      style={{
        display: 'block',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: isDesktop ? '100%' : '150px',
        width: isDesktop ? '100%' : 'fit-content',
        height: 'auto',
        minHeight: '50px',
        maxHeight: '70px',
        padding: '8px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {isAuthenticated ? props.token!.username : 'Sign In'}
    </Button>
  );
}
