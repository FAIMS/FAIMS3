import {useQuery, useMutation} from '@tanstack/react-query';
import {getAnyToken, getDefaultToken, getToken} from '../context/functions';
import {local_auth_db} from '../sync/databases';
import {requestTokenRefresh} from './apiOperations/auth';
import ObjectMap from './ObjectMap';

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

/**
 * Custom hook to fetch ANY token (by current username) for any
 * listing ID. This is cached but you can refetch on demand if needed.
 *
 * @returns An object containing the token data and query state.
 */
export const useGetAnyToken = () => {
  // Use react-query's useQuery hook to handle the API call
  const query = useQuery({
    // The query function that fetches the token
    queryFn: async () => {
      const result = await getAnyToken();
      // can't return undefined or useQuery thinks it's an error
      if (result === undefined) {
        // this looks enough like TokenContents to fool the callers
        return {token: undefined, parsedToken: undefined};
      } else {
        return result;
      }
    },
    // we don't want this to be cached since then logout would break
    queryKey: ['get any token'],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 0, // don't cache it
    staleTime: 0, // no really, please don't
    enabled: true, // always refetch
  });

  // Return an object with the token and query state
  return query;
};

export interface UseRefreshTokenProps {
  listingId: string;
  // Uses current if not provided
  username: string;
}
export const useRefreshToken = (props: UseRefreshTokenProps) => {
  /**
    Hook: useRefreshToken

    This is a mutation which can perform a token refresh on demand
    */
  return useMutation({
    mutationFn: async () => {
      // get the auth information for the listing
      const {available_tokens, current_username} = await local_auth_db.get(
        props.listingId
      );

      // use either the current or the props username
      const username = props.username ?? current_username;

      // now get tokens for that username
      const tokens = ObjectMap.get(available_tokens, username);

      if (!tokens || !tokens?.refreshToken) {
        throw Error(
          'Could not refresh token since auth DB does not contain refresh token for the listing ' +
            props.listingId
        );
      }

      // Now we have a refresh token
      const refreshToken = tokens.refreshToken;

      // Now make query to the refresh API
      const updatedToken = await requestTokenRefresh(props.listingId, props.username, {
        refreshToken,
      });

      return updatedToken.token;
    },
  });
};
