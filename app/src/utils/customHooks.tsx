import {ListingsObject} from '@faims3/data-model/src/types';
import {useQuery, UseQueryResult} from '@tanstack/react-query';
import React, {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import * as ROUTES from '../constants/routes';
import {OfflineFallbackComponent} from '../gui/components/ui/OfflineFallback';
import {directory_db} from '../sync/databases';
import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';

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

/**
 * Fetches listings from the directory database.
 * @returns Promise<ListingsObject[]>
 */
const fetchListings = async (): Promise<ListingsObject[]> => {
  const {rows} = await directory_db.local.allDocs({
    include_docs: true,
  });

  return rows.map(row => row.doc).filter(d => d !== undefined);
};

/**
 * Custom hook to fetch and manage listings from a directory database using React Query.
 */
export const useGetListings = (): UseQueryResult<ListingsObject[], Error> => {
  return useQuery<ListingsObject[], Error>({
    queryKey: ['listings'],
    queryFn: fetchListings,
  });
};

/*
QUERY PARAMS MANAGER
====================
*/

/**
 * Configuration for a single query parameter
 * @template T The type of the parameter value
 */
type QueryParamConfig<T> = {
  /** The key used in the URL query string */
  key: string;
  /** Default value if the parameter is not present */
  defaultValue?: T;
  /** Function to convert the string from the URL to the parameter type */
  parser?: (value: string) => T;
  /** Function to convert the parameter value to a string for the URL */
  serializer?: (value: T) => string;
};

type QueryParamValue<T> = T | undefined;

/**
 * Hook result containing the current parameters and methods to update them
 */
type UseQueryParamsResult<T extends Record<string, any>> = {
  /** Current parameter values */
  params: {[K in keyof T]: QueryParamValue<T[K]>};
  /** Set a single parameter value */
  setParam: <K extends keyof T>(key: K, value: T[K] | undefined) => void;
  /** Set multiple parameter values at once */
  setParams: (values: Partial<{[K in keyof T]: T[K] | undefined}>) => void;
  /** Remove a single parameter */
  removeParam: (key: keyof T) => void;
  /** Remove all parameters */
  removeAllParams: () => void;
};

// Default converters if none provided in config
const defaultParser = (value: string) => value;
const defaultSerializer = (value: any) => String(value);

/**
 * Hook to manage URL query parameters with type safety
 *
 * @example
 * // Track the active tab index in the URL
 * const { params, setParam } = useQueryParams<{tabIndex: number}>({
 *   tabIndex: {
 *     key: 'tab',
 *     defaultValue: 0,
 *     parser: value => parseInt(value)
 *   }
 * });
 *
 * // URL will show ?tab=0 by default
 * // params.tabIndex will be the current tab number
 * // setParam('tabIndex', 2) will update URL to ?tab=2
 */
export function useQueryParams<T extends Record<string, any>>(config: {
  [K in keyof T]: QueryParamConfig<T[K]>;
}): UseQueryParamsResult<T> {
  // Use React Router's search params hook for URL management
  const [searchParams, setSearchParams] = useSearchParams();
  // Track initial mount to only set defaults once
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Only run this effect on the first mount
    if (isInitialMount.current) {
      const updates = new URLSearchParams(searchParams);
      let hasUpdates = false;

      // Check each configured parameter
      Object.entries(config).forEach(([_, paramConfig]) => {
        const value = searchParams.get(paramConfig.key);
        // If param is missing from URL but has a default value, add it
        if (value === null && paramConfig.defaultValue !== undefined) {
          // Use serialiser to add value to URL
          const serializer = paramConfig.serializer || defaultSerializer;
          updates.set(paramConfig.key, serializer(paramConfig.defaultValue));
          hasUpdates = true;
        }
      });

      // Only update URL if we added any default values
      if (hasUpdates) {
        setSearchParams(updates);
      }
      isInitialMount.current = false;
    }
  }, [config, searchParams, setSearchParams]);

  // Convert URL string values to typed parameters
  const params = Object.entries(config).reduce(
    (acc, [key, paramConfig]) => {
      const value = searchParams.get(paramConfig.key);
      const parser = paramConfig.parser || defaultParser;

      // Use parsed URL value if present, otherwise use default
      acc[key as keyof T] =
        value !== null ? parser(value) : paramConfig.defaultValue;

      return acc;
    },
    {} as {[K in keyof T]: QueryParamValue<T[K]>}
  );

  // Update a single parameter in the URL
  const setParam = useCallback(
    <K extends keyof T>(key: K, value: T[K] | undefined) => {
      const paramConfig = config[key];
      const serializer = paramConfig.serializer || defaultSerializer;

      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        // Remove param if value is undefined, otherwise set it
        if (value === undefined) {
          next.delete(paramConfig.key);
        } else {
          next.set(paramConfig.key, serializer(value));
        }
        return next;
      });
    },
    [config, setSearchParams]
  );

  // Update multiple parameters at once
  const setMultipleParams = useCallback(
    (values: Partial<{[K in keyof T]: T[K] | undefined}>) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);

        // Process each parameter update
        Object.entries(values).forEach(([key, value]) => {
          const paramConfig = config[key as keyof T];
          const serializer = paramConfig.serializer || defaultSerializer;

          if (value === undefined) {
            next.delete(paramConfig.key);
          } else {
            next.set(paramConfig.key, serializer(value));
          }
        });

        return next;
      });
    },
    [config, setSearchParams]
  );

  // Remove a specific parameter from the URL
  const removeParam = useCallback(
    (key: keyof T) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete(config[key].key);
        return next;
      });
    },
    [config, setSearchParams]
  );

  // Clear all parameters from the URL
  const removeAllParams = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    params,
    setParam,
    setParams: setMultipleParams,
    removeParam,
    removeAllParams,
  };
}
