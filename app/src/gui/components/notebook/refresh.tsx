import RefreshIcon from '@mui/icons-material/Refresh';
import {Box, Button, Typography} from '@mui/material';
import moment from 'moment/moment';
import React from 'react';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {addAlert} from '../../../context/slices/alertSlice';
import {useAppDispatch} from '../../../context/store';
import {useInterval} from '../../../utils/useInterval';

interface RefreshNotebookProps {
  handleRefresh: Function;
  project_name: string;
}

/**
 * RefreshNotebook component displays the last refresh time of the notebook
 * and allows users to refresh the notebook's data. The component updates
 * the time since the last refresh every second and shows a warning color
 * if the data has not been refreshed for a certain period.
 *
 * @param {RefreshNotebookProps} props - The properties for the RefreshNotebook component.
 * @param {Function} props.handleRefresh - Function to refresh the notebook's data.
 * @param {string} props.project_name - The name of the project associated with the notebook.
 * @returns {JSX.Element} - The JSX element for the RefreshNotebook component.
 */
export default function RefreshNotebook(props: RefreshNotebookProps) {
  /**
   * LAST_REFRESH_FORMAT defines the date format for displaying the last refresh time.
   */
  const LAST_REFRESH_FORMAT = 'MMMM Do YYYY, LTS';

  /**
   * TIME_LAPSED defines the threshold time in seconds after which the refresh alert changes to a warning.
   */
  const TIME_LAPSED = 600; //s

  const [lastRefresh, setLastRefresh] = React.useState(
    moment().format(LAST_REFRESH_FORMAT)
  );
  const [fromNow, setFromNow] = React.useState(
    moment(lastRefresh, LAST_REFRESH_FORMAT).fromNow()
  );

  const [counter, setCounter] = React.useState(0);

  const dispatch = useAppDispatch();

  /**
   * handleRefresh triggers the refresh process for the notebook data.
   * It updates the last refresh time and shows a success or error alert based on the outcome.
   */
  const handleRefresh = () => {
    props
      .handleRefresh()
      .then(() => {
        // clear timer and reset lastRefresh
        setCounter(0);
        setLastRefresh(moment().format(LAST_REFRESH_FORMAT));
        dispatch(
          addAlert({
            message: `${props.project_name} ${NOTEBOOK_NAME_CAPITALIZED} refreshed`,
            severity: 'success',
          })
        );
      })
      .catch((err: Error) => {
        dispatch(
          addAlert({
            message: err.message,
            severity: 'error',
          })
        );
      });
  };

  /**
   * useInterval is a custom hook that increments the counter every second
   * and updates the time since the last refresh.
   */
  useInterval(() => {
    setCounter(counter => counter + 1);
    setFromNow(moment(lastRefresh, LAST_REFRESH_FORMAT).fromNow());
  }, 1000);

  return (
    <Box
      data-testid="refreshAlert"
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
      <Box sx={{textAlign: 'left'}}>
        {' '}
        {/* Left-aligned text */}
        <Typography
          variant="body2"
          color="textPrimary"
          sx={{fontWeight: 'bold', fontSize: '0.85rem', lineHeight: 1.2}}
        >
          Last refresh
        </Typography>
        <Typography
          variant="body2"
          color="textPrimary"
          sx={{fontSize: '0.85rem', lineHeight: 1.2}}
        >
          {lastRefresh}
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{fontSize: '0.75rem'}}
        >
          {fromNow}
        </Typography>
      </Box>
      <Button
        color="primary"
        startIcon={<RefreshIcon />}
        onClick={handleRefresh}
        variant="contained"
        data-testid="refreshRecords"
        sx={{marginLeft: '12px', padding: '4px 8px', fontSize: '0.75rem'}}
      >
        Refresh
      </Button>
    </Box>
  );
}
