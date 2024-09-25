import {useEffect, useRef} from 'react';
import {useQuery, UseQueryResult} from '@tanstack/react-query';
import {directory_db, ListingsObject} from '../sync/databases';

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
const useGetListings = (): UseQueryResult<ListingsObject[], Error> => {
  return useQuery<ListingsObject[], Error>({
    queryKey: ['listings'],
    queryFn: fetchListings,
  });
};

export default useGetListings;
