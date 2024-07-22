import React, {useContext} from 'react';
import {Alert, Button} from '@mui/material';
import moment from 'moment/moment';
import {ActionType} from '../../../context/actions';
import {store} from '../../../context/store';
import {useInterval} from '../../../utils/useInterval';

interface RefreshNotebookProps {
  handleRefresh: Function;
  project_name: string;
}
export default function RefreshNotebook(props: RefreshNotebookProps) {
  /**
   * Refresh alert will change to warning after TIME_LAPSED seconds.
   *
   */
  const LAST_REFRESH_FORMAT = 'MMMM Do YYYY, LTS';
  const TIME_LAPSED = 600; //s

  const [lastRefresh, setLastRefresh] = React.useState(
    moment().format(LAST_REFRESH_FORMAT)
  );
  const [fromNow, setFromNow] = React.useState(
    moment(lastRefresh, LAST_REFRESH_FORMAT).fromNow()
  );

  const [counter, setCounter] = React.useState(0);

  const globalState = useContext(store);
  const {dispatch} = globalState;

  const handleRefresh = () => {
    props
      .handleRefresh()
      .then(() => {
        // clear timer and reset lastRefresh
        setCounter(0);
        setLastRefresh(moment().format(LAST_REFRESH_FORMAT));
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: `${props.project_name} Notebook refreshed`,
            severity: 'success',
          },
        });
      })
      .catch((err: Error) => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: err.message,
            severity: 'error',
          },
        });
      });
  };

  useInterval(() => {
    setCounter(counter => counter + 1);
    setFromNow(moment(lastRefresh, LAST_REFRESH_FORMAT).fromNow());
  }, 1000);

  return (
    <Alert
      severity={counter > TIME_LAPSED ? 'warning' : 'info'}
      data-testid="refreshAlert"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleRefresh}
          data-testid="refreshRecords"
        >
          Refresh
        </Button>
      }
    >
      Last refresh {lastRefresh}, {fromNow}.
    </Alert>
  );
}
