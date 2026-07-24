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
 * Filename: impersonation-banner.tsx
 * Description:
 *   App-wide banner shown while an admin is impersonating another user.
 */

import {Button, Typography} from '@mui/material';
import Alert from '@mui/material/Alert';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  selectActiveUser,
  selectIsImpersonating,
  stopImpersonation,
} from '../../../context/slices/authSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';

/**
 * Renders a prominent banner while the active session is an impersonation
 * session, with a button to return to the admin's own account.
 */
export default function ImpersonationBanner() {
  const isImpersonating = useAppSelector(selectIsImpersonating);
  const activeUser = useAppSelector(selectActiveUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (!isImpersonating || !activeUser) {
    return null;
  }

  const impersonatedName =
    activeUser.parsedToken.name || activeUser.parsedToken.username;

  const handleReturn = async () => {
    await dispatch(stopImpersonation());
    navigate(ROUTES.INDEX);
  };

  return (
    <Alert
      severity="warning"
      variant="filled"
      square
      data-testid="app-impersonation-banner"
      sx={{
        alignItems: 'center',
        marginTop: {xs: 2, sm: 1},
      }}
      action={
        <Button
          color="inherit"
          size="small"
          variant="outlined"
          data-testid="app-impersonation-return-button"
          onClick={handleReturn}
        >
          Return to your account
        </Button>
      }
    >
      <Typography variant="body2">
        You are impersonating <b>{impersonatedName}</b> (as{' '}
        {activeUser.impersonatingUser}). Actions are performed as this user.
      </Typography>
    </Alert>
  );
}
