// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {userCanDo} from '@/hooks/auth-hooks';
import {Action, type ExistingMapAsset} from '@faims3/data-model';

/** Rename and delete: the individual owner, or a team admin. */
export function canManageMapAsset(
  user: User,
  asset: ExistingMapAsset
): boolean {
  if (!asset.ownedByTeamId) {
    return user.decodedToken?.username === asset.createdBy;
  }
  return userCanDo({
    user,
    action: Action.UPDATE_TEAM_DETAILS,
    resourceId: asset.ownedByTeamId,
  });
}

/** Replace the file: the same people who can upload into this owner. */
export function canReplaceMapAsset(
  user: User,
  asset: ExistingMapAsset
): boolean {
  if (!asset.ownedByTeamId) {
    return (
      user.decodedToken?.username === asset.createdBy &&
      userCanDo({user, action: Action.CREATE_PROJECT})
    );
  }
  return userCanDo({
    user,
    action: Action.CREATE_PROJECT_IN_TEAM,
    resourceId: asset.ownedByTeamId,
  });
}
