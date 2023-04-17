import {Typography} from '@mui/material';
import Obfuscate from 'react-obfuscate';
import React from 'react';
import {
  COMMIT_VERSION,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
  DIRECTORY_PROTOCOL,
} from '../../../buildconfig';
import {TokenContents} from 'faims3-datamodel';
import {useTheme} from '@mui/material/styles';

interface SupportEmailProps {
  token?: null | undefined | TokenContents;
}

export default function SupportEmail(props: SupportEmailProps) {
  const theme = useTheme();
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
      props.token?.username ? props.token.username : 'Unauthenticated'
    } \r` +
    `Roles: ${
      props.token?.roles ? JSON.stringify(props.token.roles) : 'Unauthenticated'
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
