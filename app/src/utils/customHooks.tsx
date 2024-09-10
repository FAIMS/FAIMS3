import React, {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import * as ROUTES from '../constants/routes';
import {OfflineFallbackComponent} from '../gui/components/ui/OfflineFallback';

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

/**
 * Custom hook to provide a remount for offline/online status change. Should be
 * used in situations where the app only works online. Provides a fallback
 * component.
 * @returns offline/online status as well as a fallback component to render over
 * the page if offline
 */
export function useIsOnline(): UseIsOnlineResponse {
  // online/offline state
  const [online, setOnline] = useState(window.navigator.onLine);
  // Routing
  const navigate = useNavigate();

  // Create handlers for window online/offline events and clean up from use effect
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
   * critical manual checkpoints.
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
      <OfflineFallbackComponent
        onRefresh={() => {
          checkIsOnline();
        }}
        onReturnHome={() => {
          navigate(ROUTES.INDEX);
        }}
      ></OfflineFallbackComponent>
    ),
  };
}
