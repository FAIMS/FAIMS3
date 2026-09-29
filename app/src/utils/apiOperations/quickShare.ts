// SPDX-License-Identifier: Apache-2.0
import {
  PostCreateQuickShareInput,
  PostCreateQuickShareResponse,
  PostCreateQuickShareResponseSchema,
  ProjectID,
  Role,
} from '@faims3/data-model';
import FetchManager from './client';

/**
 * Create a Quick Share code for one activated survey.
 * The server always issues a one-hour code. The request has to reach
 * Conductor, so this cannot run offline.
 */
export async function createQuickShare({
  serverId,
  username,
  projectId,
  role,
}: {
  serverId: string;
  username: string;
  projectId: ProjectID;
  role: Role;
}): Promise<PostCreateQuickShareResponse> {
  const body: PostCreateQuickShareInput = {role};
  const response = await FetchManager.post<PostCreateQuickShareResponse>(
    serverId,
    username,
    `/api/invites/notebook/${projectId}/quick-share`,
    body
  );
  return PostCreateQuickShareResponseSchema.parse(response);
}

/**
 * Delete every live Quick Share this person created for the survey.
 * The response does not include invite ids.
 */
export async function revokeOwnQuickShares({
  serverId,
  username,
  projectId,
}: {
  serverId: string;
  username: string;
  projectId: ProjectID;
}): Promise<void> {
  await FetchManager.delete(
    serverId,
    username,
    `/api/invites/notebook/${projectId}/quick-share`
  );
}
