import React from 'react';
import {Box, Alert, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import moment from 'moment';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import 'animate.css';
interface DraftSyncStatusProps {
  last_saved: Date | null;
  is_saving: boolean;
  error: string | null;
}
export default function DraftSyncStatus(props: DraftSyncStatusProps) {
  /**
   * TODO the draft sync state from the form needs hoisting to the record component
   * then passing to this component as prop, to ensure that we can see the sync status
   * at all times (i.e., not just on the edit tab)
   */
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: '100%',
        textAlign: 'right',
      }}
    >
      {props.error ? (
        <Alert severity={'error'} sx={{borderRadius: 0}}>
          A local draft could not be saved to your device: {props.error}
        </Alert>
      ) : (
        <Box
          sx={{backgroundColor: theme.palette.primary.main, color: 'white'}}
          p={1}
        >
          {props.is_saving ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'end',
              }}
            >
              <Typography variant={'body2'} sx={{mr: 1}}>
                Saving draft to your device...{' '}
              </Typography>
              <SaveIcon
                className={
                  'animate__animated animate__flash animate__slow animate__infinite'
                }
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'end',
              }}
            >
              <Typography variant={'body2'} sx={{mr: 1}}>
                {props.last_saved !== null
                  ? `Local draft last saved ${moment(
                      props.last_saved
                    ).fromNow()}`
                  : 'Initializing draft save'}
              </Typography>
              {props.last_saved !== null ? <CheckIcon /> : <AccessTimeIcon />}
            </div>
          )}
        </Box>
      )}
    </Box>
  );
}
