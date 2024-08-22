import React, {useContext} from 'react';
import {Alert, Box, Button, Typography} from '@mui/material';
import moment from 'moment/moment';
import {ActionType} from '../../../context/actions';
import {store} from '../../../context/store';
import {useInterval} from '../../../utils/useInterval';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import RefreshIcon from '@mui/icons-material/Refresh';


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
            message: `${props.project_name} ${NOTEBOOK_NAME_CAPITALIZED} refreshed`,
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: counter > TIME_LAPSED ? '#fff4e5' : '#e8f4fd',
        borderRadius: '4px',
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '12px',
      }}
    >
      <Box sx={{ textAlign: 'left' }}> {/* Left-aligned text */}
        <Typography
          variant="body2"
          color="textPrimary"
          sx={{ fontWeight: 'bold', fontSize: '0.85rem', lineHeight: 1.2 }}
        >
          Last refresh
        </Typography>
        <Typography
          variant="body2"
          color="textPrimary"
          sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}
        >
          {lastRefresh}
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ fontSize: '0.75rem' }}
        >
          {fromNow}
        </Typography>
      </Box>
      <Button
        color="primary"
        startIcon={<RefreshIcon />}
        onClick={handleRefresh}
        variant="contained"
        sx={{ marginLeft: '12px', padding: '4px 8px', fontSize: '0.75rem' }}  // Smaller button for compactness
      >
        Refresh
      </Button>
    </Box>
  );
}
