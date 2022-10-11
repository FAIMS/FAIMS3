import React from 'react';
import {Alert, Typography} from '@mui/material';

export default function UnpublishedWarning() {
  return (
    <div>
      <Alert severity={'warning'} variant={'filled'} sx={{borderRadius: 0}}>
        This record is unpublished. A draft version exists only on your local
        device. Scroll to the bottom of the record and click the{' '}
        <Typography variant={'overline'}>publish</Typography> button to publish
        this record. Published records will be queued for syncing to the remote
        server when the app detects a wifi connection.
      </Alert>
    </div>
  );
}
