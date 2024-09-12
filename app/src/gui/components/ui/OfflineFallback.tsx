import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import SignalWifiConnectedNoInternet4Icon from '@mui/icons-material/SignalWifiConnectedNoInternet4';
import {Box, Button, CircularProgress, Typography} from '@mui/material';
import {useState} from 'react';
import {createUseStyles as makeStyles} from 'react-jss';
import {theme} from '../../themes';

const useStyles = makeStyles({
root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: theme.palette.background.default,
  },
  container: {
    padding: theme.spacing(4),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[1],
    textAlign: 'center',
  },
  logo: {
    width: theme.spacing(12),
    height: theme.spacing(12),
    marginBottom: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  title: {
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
  },
  buttonContainer: {
    '& > :not(:last-child)': {
      marginRight: theme.spacing(2),
    },
  },
  primaryButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  secondaryButton: {
    color: theme.palette.text.primary,
    borderColor: theme.palette.text.primary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  buttonProgress: {
    color: theme.palette.primary.contrastText,
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },
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
