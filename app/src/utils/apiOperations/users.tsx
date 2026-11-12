// SPDX-License-Identifier: Apache-2.0
import {
  GetListAllUsersItem,
  GetListAllUsersResponse,
  LIST_LIMIT_MAX,
  PostImpersonateUserResponse,
} from '@faims3/data-model';
import FetchManager from './client';

/**
 * One page of the active users on the given server, in name order (requires
 * the VIEW_USER_LIST action). The server never returns the whole list: pass
 * the response's `nextStartKey` back as `startKey` for the next page.
 * @param serverId The server to query
 * @param username The username to authenticate as
 * @param page `limit` (1–500, server default when omitted) and the exclusive
 *   `startKey` cursor
 */
export const listUsers = async (
  serverId: string,
  username: string,
  {limit, startKey}: {limit?: number; startKey?: string} = {}
): Promise<GetListAllUsersResponse> => {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }
  if (startKey !== undefined) {
    params.set('startKey', startKey);
  }
  const query = params.toString();
  return await FetchManager.get<GetListAllUsersResponse>(
    serverId,
    username,
    `/api/users${query ? `?${query}` : ''}`
  );
};

/**
 * Every active user on the given server, in name order. Follows
 * `nextStartKey` through {@link listUsers} with the largest page the server
 * allows, so it costs one request per 500 users. For pickers that search
 * the whole user list on the device.
 * @param serverId The server to query
 * @param username The username to authenticate as
 */
export const listAllUsers = async (
  serverId: string,
  username: string
): Promise<GetListAllUsersItem[]> => {
  const users: GetListAllUsersItem[] = [];
  let startKey: string | undefined;
  do {
    const page = await listUsers(serverId, username, {
      limit: LIST_LIMIT_MAX,
      startKey,
    });
    users.push(...page.users);
    startKey = page.nextStartKey;
  } while (startKey !== undefined);
  return users;
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
