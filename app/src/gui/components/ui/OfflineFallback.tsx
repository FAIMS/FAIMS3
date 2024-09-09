import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import SignalWifiConnectedNoInternet4Icon from '@mui/icons-material/SignalWifiConnectedNoInternet4';
import {Box, Button, CircularProgress, Typography} from '@mui/material';
import {useState} from 'react';
import {createUseStyles as makeStyles} from 'react-jss';

const useStyles = makeStyles((theme: any) => {
  console.log(JSON.stringify(theme));
  return {
    root: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    },
    container: {
      padding: '32px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
      textAlign: 'center',
    },
    logo: {
      width: 100,
      height: 100,
      marginBottom: '24px',
      color: '#9E9E9E',
    },
    title: {
      color: '#333333',
      marginBottom: '8px',
    },
    subtitle: {
      color: '#666666',
      marginBottom: '24px',
    },
    buttonContainer: {
      '& > :not(:last-child)': {
        marginRight: '16px',
      },
    },
    primaryButton: {
      backgroundColor: '#4a4a4a',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#333333',
      },
    },
    secondaryButton: {
      color: '#4a4a4a',
      borderColor: '#4a4a4a',
      '&:hover': {
        backgroundColor: 'rgba(74, 74, 74, 0.04)',
      },
    },
    buttonProgress: {
      color: '#ffffff',
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -12,
      marginLeft: -12,
    },
  };
});

export interface OfflineFallbackComponentProps {
  /** What should happen when refresh button is pressed? */
  onRefresh: () => void;
  /** What should happen when return home button is pressed? */
  onReturnHome: () => void;
}

/**
 * A fallback component to use when part of app is offline.
 * @param props controls for buttons in the fallback
 * @returns A splashscreen which lays over the given view with an offline logo,
 * refresh and return home button.
 */
export const OfflineFallbackComponent = (
  props: OfflineFallbackComponentProps
) => {
  const classes = useStyles();
  const {onRefresh, onReturnHome} = props;
  // A fake loading state to reassure user that something happened.
  const [loading, setLoading] = useState(false);

  // Just show loading for 500ms when button is pressed
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onRefresh();
    }, 500);
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.container}>
        <SignalWifiConnectedNoInternet4Icon className={classes.logo} />
        <Typography variant="h4" component="h1" className={classes.title}>
          Uh oh... you're offline.
        </Typography>
        <Typography variant="subtitle1" className={classes.subtitle}>
          This part of the app doesn't work offline.
        </Typography>
        <Box className={classes.buttonContainer}>
          <Button
            variant="contained"
            className={classes.primaryButton}
            startIcon={loading ? null : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
            {loading && (
              <CircularProgress size={24} className={classes.buttonProgress} />
            )}
          </Button>
          <Button
            variant="outlined"
            className={classes.secondaryButton}
            startIcon={<HomeIcon />}
            onClick={onReturnHome}
          >
            Return Home
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
