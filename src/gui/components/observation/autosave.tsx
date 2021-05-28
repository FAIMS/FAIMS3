import React from 'react';
import {Box, CircularProgress} from '@material-ui/core';
import MuiAlert from '@material-ui/lab/Alert';
import moment from 'moment';
import CheckIcon from '@material-ui/icons/Check';

type AutosaveProps = {
  last_saved: Date;
  is_saving: boolean;
  error: string | null;
};
export default function AutoSave(props: AutosaveProps) {
  return (
    <Box mb={2}>
      <MuiAlert
        severity={props.error !== null ? 'error' : 'info'}
        icon={
          props.is_saving ? (
            <CircularProgress
              size={'1.1rem'}
              thickness={5}
              style={{color: '#2196f3'}}
            />
          ) : (
            <CheckIcon fontSize="inherit" />
          )
        }
      >
        <b>{props.error !== null ? props.error : ''}</b>&nbsp; Last saved{' '}
        {moment(props.last_saved).fromNow()}{' '}
        <small>{props.last_saved.toString()}</small>
      </MuiAlert>
    </Box>
  );
}
