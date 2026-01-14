import {
  Action,
  DatabaseInterface,
  DataDbType,
  DataDocument,
  DataEngine,
  fetchAndHydrateRecord,
  getMinimalRecordData,
  getMinimalRecordDataWithRegex,
  isAuthorized,
  MinimalRecordMetadata,
  ProjectUIModel,
  UISpecification,
  UnhydratedRecord,
} from '@faims3/data-model';
import {QueryClient, useQuery} from '@tanstack/react-query';
import _ from 'lodash';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {useSearchParams} from 'react-router-dom';
import * as ROUTES from '../constants/routes';
import {selectActiveUser} from '../context/slices/authSlice';
import {useAppSelector} from '../context/store';
import {OfflineFallbackComponent} from '../gui/components/ui/OfflineFallback';
import {localGetDataDb} from './database';
import {
  shouldDisplayRecord,
  shouldDisplayRecordMinimalMetadata,
} from '../users';

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
  const params = Object.entries(config).reduce((acc, [key, paramConfig]) => {
    const value = searchParams.get(paramConfig.key);
    const parser = paramConfig.parser || defaultParser;

    // Use parsed URL value if present, otherwise use default
    acc[key as keyof T] =
      value !== null ? parser(value) : paramConfig.defaultValue;

    return acc;
  }, {} as {[K in keyof T]: QueryParamValue<T[K]>});

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
 * NOTE: as of major-form-refactor - this is irrelevant, however there could
 * still be some drafts sitting around?
 *
 * Filters out draft records from the dataset.
 *
 * Draft records are identified by the prefix `drf-` in their `record_id`.
 */
export function filterOutDrafts<T extends MinimalRecordMetadata>(
  rows: T[]
): T[] {
  return rows.filter(record => !record.recordId.startsWith('drf-'));
}

/**
 * Filters records to include only those created by the active user.
 *
 * @param rows - The dataset of records.
 * @param username - The active user's username.
 */
export function filterByActiveUser<T extends MinimalRecordMetadata>(
  rows: T[],
  username: string
): T[] {
  return rows.filter(record => record.createdBy === username);
}

const HYDRATION_KEY_PREFIX = 'recordhydration';
const RECORD_LIST_KEY_PREFIX = 'allrecords';

/**
 * Helper function to build the hydrate query keys consistently
 */
export function buildHydrateKeys({
  recordId,
  projectId,
  revisionId,
}: {
  projectId: string;
  recordId: string;
  revisionId: string;
}) {
  return [HYDRATION_KEY_PREFIX, projectId, recordId, revisionId];
}

/**
 * Forces refetch/cache invalidation of a target record hydration. This is the
 * data fetching component of the record listing which involves many AVP
 * fetches.
 */
export function invalidateTargetRecordHydration({
  recordId,
  projectId,
  revisionId,
  client,
}: {
  projectId: string;
  recordId: string;
  revisionId: string;
  client: QueryClient;
}) {
  client.invalidateQueries({
    queryKey: buildHydrateKeys({recordId, projectId, revisionId}),
    refetchType: 'all',
  });
}

/**
 * Forces refetch/cache invalidation of a target record hydration. This is the
 * data fetching component of the record listing which involves many AVP
 * fetches.
 */
export function invalidateProjectHydration({
  projectId,
  client,
  reset = false,
}: {
  projectId: string;
  client: QueryClient;
  reset?: boolean;
}) {
  if (reset) {
    client.resetQueries({
      queryKey: [HYDRATION_KEY_PREFIX, projectId],
    });
  } else {
    client.invalidateQueries({
      queryKey: [HYDRATION_KEY_PREFIX, projectId],
      refetchType: 'all',
    });
  }
}

/**
 * Forces refetch/cache invalidation of a target record hydration. This is the
 * data fetching component of the record listing which involves many AVP
 * fetches.
 */
export function invalidateProjectRecordList({
  projectId,
  client,
  reset = false,
}: {
  projectId: string;
  client: QueryClient;
  reset?: boolean;
}) {
  if (reset) {
    client.resetQueries({
      queryKey: [RECORD_LIST_KEY_PREFIX, projectId],
    });
  } else {
    client.invalidateQueries({
      queryKey: [RECORD_LIST_KEY_PREFIX, projectId],
      refetchType: 'all',
    });
  }
}

/**
 * Returns a list of all records, and active user records. This applies the
 * built in getMetadataForAllRecords filtering (which does client side
 * permission filtering) and also provides my records vs all records list(s).
 *
 * At a high level:
 * - useQuery to get minimal record info (i.e. gets records and their latest
 *   revision) (refetches every 10 seconds and on mount)
 * - filter out drafts (memoised by record list which has structural sharing to
 *   avoid re-renders)
 * - split by current user and others (memoised)
 *
 * @param query The search string, if any - regex match
 * @param projectId Project ID to get records for
 * @param filterDeleted Whether to filter out deleted records
 * @param refreshIntervalMs Supply a refresh interval if desired
 * @param enableProfiling Enable detailed timing logs for performance profiling
 */
export const useRecordList = ({
  query = undefined,
  projectId,
  filterDeleted,
  metadataRefreshIntervalMs,
  uiSpecification: uiSpec,
  enableProfiling = false,
}: {
  query?: string;
  projectId: string;
  filterDeleted: boolean;
  metadataRefreshIntervalMs?: number | undefined | false;
  uiSpecification: ProjectUIModel;
  enableProfiling?: boolean;
}) => {
  // Profiling helper
  const profile = (label: string, startTime?: number) => {
    if (!enableProfiling) return;
    if (startTime !== undefined) {
      const duration = performance.now() - startTime;
      console.log(
        `[useRecordList:${projectId}] ${label}: ${duration.toFixed(2)}ms`
      );
    } else {
      console.log(`[useRecordList:${projectId}] ${label}`);
    }
  };

  // Work out our context e.g. active user, token, data db etc
  const activeUser = useAppSelector(selectActiveUser);
  const token = activeUser?.parsedToken;
  const dataDb = localGetDataDb(projectId);

  // First - just fetch a list of all unhydrated records
  const unhydratedRecordQuery = useQuery({
    queryKey: [
      RECORD_LIST_KEY_PREFIX,
      projectId,
      query,
      filterDeleted,
      activeUser?.username,
      token?.globalRoles,
      token?.resourceRoles,
    ],
    networkMode: 'always',
    gcTime: 0,
    refetchInterval: metadataRefreshIntervalMs,
    // implement a custom structural sharing function to avoid re-renders when
    // the list of records is the same
    structuralSharing: (oldData, newData) => {
      const structuralSharingStart = performance.now();
      const isEqual = _.isEqual(oldData, newData);
      if (enableProfiling) {
        const duration = performance.now() - structuralSharingStart;
        const oldCount = Array.isArray(oldData) ? oldData.length : 0;
        const newCount = Array.isArray(newData) ? newData.length : 0;
        console.log(
          `[useRecordList:${projectId}] structuralSharing: ${duration.toFixed(
            2
          )}ms | ` +
            `oldCount=${oldCount}, newCount=${newCount}, isEqual=${isEqual}`
        );
      }
      return isEqual ? oldData : newData;
    },
    queryFn: async () => {
      console.log('Running query - not cached');
      const queryFnStart = performance.now();
      profile(
        `queryFn started | query="${
          query ?? ''
        }", filterDeleted=${filterDeleted}`
      );

      if (!token) {
        // Trying to run without token!
        console.warn('Trying to fetch record list without user token.');
        return [];
      }

      const engine = new DataEngine({
        dataDb: dataDb as DatabaseInterface<DataDocument>,
        uiSpec,
      });

      let rows;
      if (query === undefined || query.length === 0) {
        const fetchStart = performance.now();
        rows = await engine.query.listMinimalRecordMetadata({
          projectId,
          filterDeleted,
          filterFunction: rec => {
            return shouldDisplayRecordMinimalMetadata({
              contents: token,
              projectId,
              recordMetadata: rec,
            });
          },
        });
        profile(
          `getMinimalRecordData completed (${rows.count} rows)`,
          fetchStart
        );
      } else {
        const fetchStart = performance.now();
        rows = await engine.query.searchRecordsByRegex({
          // The regex to look for
          regex: query,
          projectId,
          filterDeleted,
          filterFunction: rec => {
            return shouldDisplayRecordMinimalMetadata({
              contents: token,
              projectId,
              recordMetadata: rec,
            });
          },
        });
        profile(
          `searchRecordsByRegex completed (${rows.count} rows, regex="${query}")`,
          fetchStart
        );
      }

      profile(`queryFn completed (total)`, queryFnStart);
      return rows.records;
    },
  });

  // Get all rows - defaulting to an empty list
  const allRows = unhydratedRecordQuery.data ?? [];

  // Memoize the calculation of the non-draft rows
  const nonDraftRecords = useMemo(() => {
    const filterStart = performance.now();
    const result = filterOutDrafts(allRows);
    if (enableProfiling) {
      const duration = performance.now() - filterStart;
      console.log(
        `[useRecordList:${projectId}] filterOutDrafts: ${duration.toFixed(
          2
        )}ms | ` +
          `input=${allRows.length}, output=${result.length}, filtered=${
            allRows.length - result.length
          }`
      );
    }
    return result;
  }, [allRows, enableProfiling, projectId]);

  // Memoize the calculation of the current user rows
  const {myRecords, otherRecords} = useMemo(() => {
    const splitStart = performance.now();

    let justMyRecords: MinimalRecordMetadata[] = [];
    // Get just my records
    if (activeUser) {
      const filterByUserStart = performance.now();
      justMyRecords = filterByActiveUser(nonDraftRecords, activeUser.username);
      if (enableProfiling) {
        const duration = performance.now() - filterByUserStart;
        console.log(
          `[useRecordList:${projectId}] filterByActiveUser: ${duration.toFixed(
            2
          )}ms | ` +
            `user="${activeUser.username}", found=${justMyRecords.length}`
        );
      }
    }

    // Get all other records
    const otherFilterStart = performance.now();
    const myRecordIds = new Set(justMyRecords.map(r => r.recordId));
    const otherRecords = nonDraftRecords.filter(
      r => !myRecordIds.has(r.recordId)
    );

    if (enableProfiling) {
      const otherDuration = performance.now() - otherFilterStart;
      const totalDuration = performance.now() - splitStart;
      console.log(
        `[useRecordList:${projectId}] otherRecords filter: ${otherDuration.toFixed(
          2
        )}ms | ` + `count=${otherRecords.length}`
      );
      console.log(
        `[useRecordList:${projectId}] split records (total): ${totalDuration.toFixed(
          2
        )}ms | ` +
          `myRecords=${justMyRecords.length}, otherRecords=${otherRecords.length}`
      );
    }

    return {
      myRecords: justMyRecords,
      otherRecords,
    };
  }, [nonDraftRecords, activeUser, enableProfiling, projectId]);

  // Log final state when profiling
  if (enableProfiling) {
    console.log(
      `[useRecordList:${projectId}] render complete | ` +
        `status=${unhydratedRecordQuery.status}, ` +
        `allRecords=${nonDraftRecords.length}, ` +
        `myRecords=${myRecords.length}, ` +
        `otherRecords=${otherRecords.length}`
    );
  }

  // return both curated record lists and the underlying query where necessary
  return {
    allRecords: nonDraftRecords,
    myRecords: myRecords,
    otherRecords: otherRecords,
    initialQuery: unhydratedRecordQuery,
  };
};

/** useQuery to fetch and hydrate individual targeted revision of record */
export const useIndividualHydratedRecord = ({
  projectId,
  recordId,
  revisionId,
  uiSpec,
}: {
  projectId: string;
  recordId: string;
  revisionId: string;
  uiSpec: ProjectUIModel;
}) => {
  // Work out our context e.g. active user, token, data db etc
  const activeUser = useAppSelector(selectActiveUser);
  const token = activeUser?.parsedToken;
  const dataDb = localGetDataDb(projectId);

  return useQuery({
    queryKey: [
      activeUser?.username,
      token?.globalRoles,
      token?.resourceRoles,
      ...buildHydrateKeys({
        projectId,
        recordId,
        revisionId,
      }),
    ],
    queryFn: () => {
      // Grab the minimal metadata
      return fetchAndHydrateRecord({
        dataDb,
        uiSpecification: uiSpec,
        projectId,
        recordId,
        revisionId,
      });
    },
    networkMode: 'always',
  });
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

/**
 * A simple custom hook which returns whether the user can do the thing, and
 * re-renders if token changes. Applies to the active user.
 */
export const useIsAuthorisedTo = ({
  action,
  resourceId,
}: {
  action: Action;
  resourceId?: string;
}): boolean => {
  const activeUser = useAppSelector(selectActiveUser);
  if (!activeUser) {
    return false;
  }

  return useMemo(
    () =>
      isAuthorized({
        decodedToken: activeUser.parsedToken,
        action,
        resourceId,
      }),
    [action, resourceId, activeUser.token]
  );
};

/** For a given record, determines the form type, then fetches the layout from
 * the uiSpec */
export const useUiSpecLayout = ({
  recordId,
  uiSpec,
  dataDb,
}: {
  recordId: string;
  uiSpec: UISpecification;
  dataDb: DataDbType;
}) => {
  // Query to fetch the relevant viewset
  return useQuery({
    queryKey: ['record-ui-spec', recordId, uiSpec],
    queryFn: async () => {
      const engine = new DataEngine({
        dataDb: dataDb as DatabaseInterface<DataDocument>,
        uiSpec,
      });
      const rec = await engine.core.getRecord(recordId);
      const formId = rec.type;
      return uiSpec.viewsets[formId];
    },
    networkMode: 'always',
    refetchOnMount: true,
  });
};
