import React, {useContext} from 'react';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import {makeStyles, Theme} from '@material-ui/core/styles';
import {store} from '../../store';
import {ActionType} from '../../actions';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: theme.spacing(2),
    },
  },
}));

export default function SystemAlert() {
  const classes = useStyles();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const handleClose = (key: string) => {
    dispatch({
      type: ActionType.DELETE_ALERT,
      payload: {
        key: key,
      },
    });
  };

  const alerts = globalState.state.alerts;
  const oldest_alert = alerts[0];
  return (
    <div className={classes.root}>
      {alerts.length > 0 ? (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          anchorOrigin={{vertical: 'top', horizontal: 'right'}}
        >
          <MuiAlert
            onClose={() => handleClose(oldest_alert.key)}
            severity={oldest_alert.severity}
          >
            {oldest_alert.message}
          </MuiAlert>
        </Snackbar>
      ) : (
        ''
      )}
    </div>
  );
}
