import React from 'react';
import {Alert, Typography} from '@mui/material';

export default function UnpublishedWarning() {
  return (
    <Alert severity={'warning'} variant={'standard'} sx={{borderRadius: 0}}>
      Click <Typography variant={'overline'}>publish</Typography> to queue this{' '}
      <b>draft</b> for sync.
    </Alert>
  );
}
