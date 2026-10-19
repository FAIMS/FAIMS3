// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {
  isAuthorizedToDeleteMapAsset,
  isAuthorizedToMutateMapAsset,
  isAuthorizedToReplaceMapAssetFiles,
  isAuthorizedToUpdateMapAssetDetails,
  type ExistingMapAsset,
  type MapAssetAuthorizationInput,
} from '@faims3/data-model';

function actingUserId(user: User): string | undefined {
  return user.decodedToken?.username;
}

function authorizeMapAsset(
  user: User,
  asset: ExistingMapAsset,
  check: (input: MapAssetAuthorizationInput) => boolean
): boolean {
  const userId = actingUserId(user);
  if (!user.decodedToken || !userId) {
    return false;
  }
  return check({
    decodedToken: user.decodedToken,
    asset,
    actingUserId: userId,
  });
}

/** Rename: creator, team manager+, or super user. */
export function canUpdateMapAssetDetails(
  user: User,
  asset: ExistingMapAsset
): boolean {
  return authorizeMapAsset(user, asset, isAuthorizedToUpdateMapAssetDetails);
}

/** Delete: creator, team admin+, or super user. */
export function canDeleteMapAsset(
  user: User,
  asset: ExistingMapAsset
): boolean {
  return authorizeMapAsset(user, asset, isAuthorizedToDeleteMapAsset);
}

/** Replace the file: creator, team manager+, or super user. */
export function canReplaceMapAsset(
  user: User,
  asset: ExistingMapAsset
): boolean {
  return authorizeMapAsset(user, asset, isAuthorizedToReplaceMapAssetFiles);
}

/** True when any library mutate action should be shown for this layer. */
export function canMutateMapAsset(
  user: User,
  asset: ExistingMapAsset
): boolean {
  return authorizeMapAsset(user, asset, isAuthorizedToMutateMapAsset);
}
