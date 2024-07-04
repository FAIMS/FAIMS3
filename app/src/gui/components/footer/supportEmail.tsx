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
  let supportEmail = 'support@fieldmark.au';
  if (
    import.meta.env.VITE_COMMIT_VERSION !== undefined &&
    import.meta.env.VITE_COMMIT_VERSION.includes('psmip')
  ) {
    supportEmail = 'support@fieldmark.au';
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
          subject: 'Fieldmark Support',
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
