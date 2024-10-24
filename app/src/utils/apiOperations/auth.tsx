import {
  PostRefreshTokenInput,
  PostRefreshTokenResponse,
} from '@faims3/data-model';
import FetchManager from './client';

/**
 * Performs a token refresh using the /auth/refresh endpoint
 * @param listingId The listing to make a refresh for
 * @param input The input which includes the refresh token
 * @returns The updated token
 */
export const requestTokenRefresh = async (
  listingId: string,
  input: PostRefreshTokenInput
): Promise<PostRefreshTokenResponse> => {
  return await FetchManager.post<PostRefreshTokenResponse>(
    listingId,
    '/api/auth/refresh',
    input
  );
};
