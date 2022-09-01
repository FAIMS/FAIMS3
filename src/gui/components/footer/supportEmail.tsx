import {Typography} from '@mui/material';
import Obfuscate from 'react-obfuscate';
import React from 'react';
import {
  AUTOACTIVATE_PROJECTS,
  COMMIT_VERSION,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
  DIRECTORY_PROTOCOL,
} from '../../../buildconfig';
import {TokenContents} from '../../../datamodel/core';

interface SupportEmailProps {
  token?: null | undefined | TokenContents;
}

export default function SupportEmail(props: SupportEmailProps) {
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
    `Autoactivating projects: ${AUTOACTIVATE_PROJECTS ? 'True' : 'False'} \r` +
    `Username: ${
      props.token?.username ? props.token.username : 'Unauthenticated'
    } \r` +
    `Roles: ${
      props.token?.roles ? JSON.stringify(props.token.roles) : 'Unauthenticated'
    }`;

  return (
    <Typography variant="subtitle2" color="secondary">
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
