import {Typography} from '@mui/material';
import Obfuscate from 'react-obfuscate';
import React, {useContext} from 'react';
import {
  COMMIT_VERSION,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
  DIRECTORY_PROTOCOL,
} from '../../../buildconfig';
import {useTheme} from '@mui/material/styles';
import {store} from '../../../context/store';

export default function SupportEmail() {
  const theme = useTheme();
  const {state} = useContext(store);
  let supportEmail = 'info@faims.edu.au';
  if (
    process.env.REACT_APP_COMMIT_VERSION !== undefined &&
    process.env.REACT_APP_COMMIT_VERSION.includes('psmip')
  ) {
    supportEmail = 'psmipsupport@faims.edu.au';
  }
  const bodyContent =
    `Directory Server: ${DIRECTORY_PROTOCOL}://${DIRECTORY_HOST}:${DIRECTORY_PORT}/ \r` +
    `Commit Version: ${COMMIT_VERSION} \r` +
    `Username: ${
      state.token?.username ? state.token.username : 'Unauthenticated'
    } \r` +
    `Roles: ${
      state.token?.roles ? JSON.stringify(state.token.roles) : 'Unauthenticated'
    }`;

  return (
    <Typography variant="subtitle2" color={theme.palette.grey[900]}>
      Support:{' '}
      <Obfuscate
        className={'support-link'}
        email={supportEmail}
        headers={{
          subject: 'FAIMS3 Support',
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
