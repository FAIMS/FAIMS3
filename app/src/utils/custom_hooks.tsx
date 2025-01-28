import {ListingsObject} from '@faims3/data-model/src/types';
import {useQuery} from '@tanstack/react-query';
import {useEffect, useRef} from 'react';
import {directory_db} from '../sync/databases';

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

/**
 * Fetches a specific listing from the directory database.
 * @returns Promise<ListingsObject | undefined>
 */
const fetchListing = async (
  serverId: string
): Promise<ListingsObject | undefined> => {
  try {
    return await directory_db.local.get(serverId);
  } catch {
    return undefined;
  }
};

/**
 * Custom hook to fetch and manage listings from a directory database using
 * React Query.
 */
export const useGetListing = (input: {serverId?: string}) => {
  return useQuery({
    queryKey: ['listings', input.serverId],
    queryFn: async () => {
      if (!input.serverId) {
        return null;
      }
      return (await fetchListing(input.serverId)) || null;
    },
  });
};
