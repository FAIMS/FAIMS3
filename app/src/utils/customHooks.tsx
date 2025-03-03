import {
  getMetadataForAllRecords,
  getRecordsWithRegex,
  ProjectUIModel,
  RecordMetadata,
} from '@faims3/data-model';
import {useQuery} from '@tanstack/react-query';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {useSearchParams} from 'react-router-dom';
import * as ROUTES from '../constants/routes';
import {selectActiveUser} from '../context/slices/authSlice';
import {useAppSelector} from '../context/store';
import {OfflineFallbackComponent} from '../gui/components/ui/OfflineFallback';
import {DraftFilters, listDraftMetadata} from '../sync/draft-storage';
import _ from 'lodash';

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/**
 * Filters out draft records from the dataset.
 *
 * Draft records are identified by the prefix `drf-` in their `record_id`.
 */
const filterOutDrafts = (rows: RecordMetadata[]) => {
  return rows.filter(record => !record.record_id.startsWith('drf-'));
};

/**
 * Filters records to include only thosse created by the active user.
 *
 * @param rows - The dataset of records.
 * @param username - The active user's username.
 */
const filterByActiveUser = (rows: RecordMetadata[], username: string) => {
  return rows.filter(record => record.created_by === username);
};

/**
 * Returns a list of all records, and active user records. This applies the
 * built in getMetadataForAllRecords filtering (which does client side
 * permission filtering) and also provides my records vs all records list(s).
 *
 * @param query The search string, if any - regex match
 * @param projectId Project ID to get records for
 * @param filterDeleted Whether to filter out deleted records
 * @param refreshIntervalMs Supply a refresh interval if desired
 */
export const useRecordList = ({
  query,
  projectId,
  filterDeleted,
  refreshIntervalMs,
  uiSpecification: uiSpec,
}: {
  query: string;
  projectId: string;
  filterDeleted: boolean;
  refreshIntervalMs?: number | undefined | false;
  uiSpecification: ProjectUIModel;
}) => {
  const activeUser = useAppSelector(selectActiveUser);
  const token = activeUser?.parsedToken;

  const records = useQuery({
    queryKey: [
      'allrecords',
      query,
      projectId,
      filterDeleted,
      activeUser?.username,
      token?.roles,
    ],
    networkMode: 'always',
    gcTime: 0,
    refetchInterval: refreshIntervalMs,
    // implement a custom structural sharing function to avoid re-renders when
    // the list of records is the same
    structuralSharing: (oldData, newData) => {
      return _.isEqual(oldData, newData) ? oldData : newData;
    },
    queryFn: async () => {
      if (!token) {
        // Trying to run without token!
        console.warn('Trying to fetch record list without user token.');
        return [];
      }
      let rows;

      console.log('Fetching records');
      if (query.length === 0) {
        rows = await getMetadataForAllRecords(
          token,
          projectId,
          filterDeleted,
          uiSpec
        );
      } else {
        rows = await getRecordsWithRegex(
          token,
          projectId,
          query,
          filterDeleted,
          uiSpec
        );
      }

      console.log('Done');
      return rows;
    },
  });

  // Get all rows - defaulting to an empty list
  const allRows = records.data ?? [];

  // Memoize the calculation of the current user rows
  const {myRecords, otherRecords} = useMemo(() => {
    const noDrafts = filterOutDrafts(allRows);
    let justMyRecords: RecordMetadata[] = [];

    // Get just my records
    if (activeUser) {
      justMyRecords = filterByActiveUser(noDrafts, activeUser.username);
    }

    // Get all other records
    const otherRecords = noDrafts.filter(r => {
      // other records are all drafts are not in the my records list
      return !justMyRecords.map(r => r.record_id).includes(r.record_id);
    });

    return {myRecords: justMyRecords, otherRecords: otherRecords};
  }, [records, activeUser]);

  // return both curated record lists and the underlying query where necessary
  return {allRecords: allRows, myRecords, otherRecords, query: records};
};

/**
 * Does a potentially auto-refetching fetch of the drafts list for use in
 * the draft list.
 */
export const useDraftsList = ({
  projectId,
  refreshIntervalMs,
  filter,
}: {
  projectId: string;
  refreshIntervalMs?: number | undefined | false;
  filter: DraftFilters;
}) => {
  const records = useQuery({
    queryKey: ['drafts', projectId, filter],
    networkMode: 'always',
    gcTime: 0,
    refetchInterval: refreshIntervalMs,
    queryFn: async () => {
      return Object.values(await listDraftMetadata(projectId, filter));
    },
  });

  return records;
};

/**
 * A custom hook that creates a debounced version of any value
 * @param value The value to be debounced
 * @param delay The delay in milliseconds for the debounce
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay = 500): T {
  // State to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a timeout to update the debounced value
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if the value changes or the component unmounts
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]); // Only re-run if value or delay changes

  return debouncedValue;
}

interface LoadingDebounce {
  minDuration?: number; // Minimum duration for loading state in ms
  delayExitBy?: number; // Additional delay before exiting loading state
}

/**
 * A custom hook that ensures loading states have a minimum duration,
 * particularly useful for preventing flash of loading states
 * @param isLoading Current loading state
 * @param options Configuration options
 * @returns Controlled loading state
 */
export function useLoadingDebounce(
  isLoading: boolean,
  {minDuration = 1000, delayExitBy = 0}: LoadingDebounce = {}
): boolean {
  const [stabilizedLoading, setStabilizedLoading] = useState(isLoading);
  const loadingStartTime = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If transitioning to loading state
    if (isLoading) {
      loadingStartTime.current = Date.now();
      setStabilizedLoading(true);
      return;
    }

    // If transitioning from loading to not loading
    if (!isLoading && loadingStartTime.current !== null) {
      const elapsedTime = Date.now() - loadingStartTime.current;
      const remainingTime = Math.max(0, minDuration - elapsedTime);
      const totalDelay = remainingTime + delayExitBy;

      if (totalDelay > 0) {
        timeoutRef.current = setTimeout(() => {
          setStabilizedLoading(false);
          loadingStartTime.current = null;
        }, totalDelay);
      } else {
        setStabilizedLoading(false);
        loadingStartTime.current = null;
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, minDuration, delayExitBy]);

  return stabilizedLoading;
}
