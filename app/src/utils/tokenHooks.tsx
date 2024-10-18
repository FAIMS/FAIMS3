import {useQuery} from '@tanstack/react-query';
import {getDefaultToken, getToken} from '../context/functions';

/**
 * Custom hook to fetch the current token (by current username) for a given
 * listing ID. This is cached but you can refetch on demand if needed.
 *
 * // TODO may need to consider implications of caching this query
 *
 * @param  listingId - The ID of the listing to fetch the token for.
 * @returns An object containing the token data and query state.
 */
export const useGetToken = (props: {listingId: string}) => {
  // Use react-query's useQuery hook to handle the API call
  const query = useQuery({
    // The query function that fetches the token
    queryFn: async () => {
      return await getToken(props.listingId);
    },
    // The query key, which includes the listing ID to ensure proper caching
    queryKey: ['get token', props.listingId],
    staleTime: 0,
  });

  // Return an object with the token and query state
  return query;
};

/**
 * Custom hook to fetch the current token (by current username) for a given
 * listing ID. This is cached but you can refetch on demand if needed.
 *
 * // TODO may need to consider implications of caching this query
 *
 * @returns An object containing the token data and query state.
 */
export const useGetDefaultToken = () => {
  // Use react-query's useQuery hook to handle the API call
  const query = useQuery({
    // The query function that fetches the token
    queryFn: async () => {
      return await getDefaultToken();
    },
    // The query key, which includes the listing ID to ensure proper caching
    queryKey: ['get default token'],
  });

  // Return an object with the token and query state
  return query;
};
