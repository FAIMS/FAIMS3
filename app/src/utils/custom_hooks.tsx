import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Box, Button, CircularProgress, Typography} from '@mui/material';
import React, {useEffect, useRef, useState} from 'react';
import {createUseStyles as makeStyles} from 'react-jss';
import {useNavigate} from 'react-router';
import * as ROUTES from '../constants/routes';

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
      filter: 'grayscale(100%)',
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

interface OfflineFallbackComponentProps {
  onRefresh: () => void;
  onReturnHome: () => void;
}

const OfflineFallback = (props: OfflineFallbackComponentProps) => {
  const classes = useStyles();
  const {onRefresh, onReturnHome} = props;
  const [loading, setLoading] = useState(false);

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
        <svg
          className={classes.logo}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="50" cy="50" r="45" fill="#E0E0E0" />
          <path
            d="M30 35 L70 65 M70 35 L30 65"
            stroke="#9E9E9E"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
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

export const usePrevious = <T extends {}>(value: T): T | undefined => {
  /**
   * Capture the previous value of a state variable (useful for functional components
   * in place of class-based lifecycle method componentWillUpdate)
   */
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export interface UseIsOnlineResponse {
  // does the browser have network connectivity?
  isOnline: boolean;
  // forcefully recheck online status
  checkIsOnline: () => boolean;
  // fallback component which can be used when the browser is offline to hide
  // components
  fallback: React.ReactNode;
}

export function useIsOnline(): UseIsOnlineResponse {
  const [online, setOnline] = useState(window.navigator.onLine);
  const navigate = useNavigate();
  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Forcefully checks is online and uses setOnline to prompt remount where
   * necessary. Should be redundant given event handlers but might be useful for
   * critical checks.
   * @returns Current online status
   */
  const checkIsOnline = () => {
    const online = window.navigator.onLine;
    setOnline(online);
    return online;
  };

  return {
    isOnline: online,
    checkIsOnline: checkIsOnline,
    fallback: (
      <OfflineFallback
        onRefresh={() => {
          checkIsOnline();
        }}
        onReturnHome={() => {
          navigate(ROUTES.INDEX);
        }}
      ></OfflineFallback>
    ),
  };
}
