// SPDX-License-Identifier: Apache-2.0

/*
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
