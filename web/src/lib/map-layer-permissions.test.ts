// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {
  Role,
  type ExistingMapAsset,
  type TokenContents,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  canDeleteMapAsset,
  canMutateMapAsset,
  canReplaceMapAsset,
  canUpdateMapAssetDetails,
} from './map-layer-permissions';

const teamId = 'team-1';
const asset = {
  _id: 'asset-1',
  createdBy: 'owner',
  ownedByTeamId: teamId,
} as ExistingMapAsset;

function user(username: string, extras: Partial<TokenContents> = {}): User {
  return {
    user: {} as User['user'],
    token: 't',
    refreshToken: 'r',
    decodedToken: {
      username,
      name: username,
      server: 'http://localhost',
      exp: 9e9,
      globalRoles: [Role.GENERAL_USER],
      resourceRoles: [],
      ...extras,
    },
  };
}

describe('map layer permission wrappers', () => {
  it('denies access when the session has no decoded token or username', () => {
    const signedOut: User = {
      user: {} as User['user'],
      token: 't',
      refreshToken: 'r',
      decodedToken: null,
    };
    expect(canMutateMapAsset(signedOut, asset)).toBe(false);
    expect(canUpdateMapAssetDetails(signedOut, asset)).toBe(false);

    const noUsername = user('owner', {username: ''});
    expect(canDeleteMapAsset(noUsername, asset)).toBe(false);
    expect(canReplaceMapAsset(noUsername, asset)).toBe(false);
  });

  it('lets the creator mutate a team-owned layer', () => {
    const owner = user('owner');
    expect(canUpdateMapAssetDetails(owner, asset)).toBe(true);
    expect(canReplaceMapAsset(owner, asset)).toBe(true);
    expect(canDeleteMapAsset(owner, asset)).toBe(true);
    expect(canMutateMapAsset(owner, asset)).toBe(true);
  });

  it("does not let a team member mutate someone else's layer", () => {
    const member = user('other', {
      resourceRoles: [{resourceId: teamId, role: Role.TEAM_MEMBER}],
    });
    expect(canUpdateMapAssetDetails(member, asset)).toBe(false);
    expect(canReplaceMapAsset(member, asset)).toBe(false);
    expect(canDeleteMapAsset(member, asset)).toBe(false);
    expect(canMutateMapAsset(member, asset)).toBe(false);
  });

  it("lets a team manager rename or replace but not delete another member's layer", () => {
    const manager = user('manager', {
      resourceRoles: [{resourceId: teamId, role: Role.TEAM_MANAGER}],
    });
    expect(canUpdateMapAssetDetails(manager, asset)).toBe(true);
    expect(canReplaceMapAsset(manager, asset)).toBe(true);
    expect(canDeleteMapAsset(manager, asset)).toBe(false);
    expect(canMutateMapAsset(manager, asset)).toBe(true);
  });
});
