import {
  GetListAllUsersResponse,
  PostImpersonateUserResponse,
} from '@faims3/data-model';
import FetchManager from './client';

/**
 * Lists all users on the given server (requires the VIEW_USER_LIST action).
 * @param serverId The server to query
 * @param username The username to authenticate as
 */
export const listUsers = async (
  serverId: string,
  username: string
): Promise<GetListAllUsersResponse> => {
  return await FetchManager.get<GetListAllUsersResponse>(
    serverId,
    username,
    '/api/users'
  );
};

/**
 * Requests an impersonation token pair for the target user (requires the
 * IMPERSONATE_USER action). The returned tokens authenticate as the target
 * user.
 * @param serverId The server to authenticate against
 * @param username The username (admin) to authenticate as
 * @param targetUserId The id of the user to impersonate
 */
export const impersonateUser = async (
  serverId: string,
  username: string,
  targetUserId: string
): Promise<PostImpersonateUserResponse> => {
  return await FetchManager.post<PostImpersonateUserResponse>(
    serverId,
    username,
    `/api/users/${encodeURIComponent(targetUserId)}/impersonate`,
    {}
  );
};
