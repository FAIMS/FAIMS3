/**
 * Create a Quick Share code for one activated survey.
 * The request has to reach Conductor, so this cannot run offline.
 */

import {
  PostCreateQuickShareInput,
  PostCreateQuickShareResponse,
  PostCreateQuickShareResponseSchema,
  ProjectID,
  Role,
} from '@faims3/data-model';
import FetchManager from './client';

export async function createQuickShare({
  serverId,
  username,
  projectId,
  role,
  lifetimeMs,
}: {
  serverId: string;
  username: string;
  projectId: ProjectID;
  role: Role;
  lifetimeMs: number;
}): Promise<PostCreateQuickShareResponse> {
  const body: PostCreateQuickShareInput = {role, lifetimeMs};
  const response = await FetchManager.post<PostCreateQuickShareResponse>(
    serverId,
    username,
    `/api/invites/notebook/${projectId}/quick-share`,
    body
  );
  return PostCreateQuickShareResponseSchema.parse(response);
}

/** Delete the stored Quick Share so it can no longer be redeemed. */
export async function revokeQuickShare({
  serverId,
  username,
  projectId,
  inviteId,
}: {
  serverId: string;
  username: string;
  projectId: ProjectID;
  inviteId: string;
}): Promise<void> {
  await FetchManager.delete(
    serverId,
    username,
    `/api/invites/notebook/${projectId}/${encodeURIComponent(inviteId)}`
  );
}
