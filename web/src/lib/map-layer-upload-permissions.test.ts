// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {userCanUploadMapLayer} from '@/hooks/auth-hooks';
import {Role, type TokenContents} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';

const teamId = 'team-1';

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

describe('userCanUploadMapLayer', () => {
  it('denies a signed-out session', () => {
    expect(userCanUploadMapLayer(null)).toBe(false);

    const signedOut: User = {
      user: {} as User['user'],
      token: 't',
      refreshToken: 'r',
      decodedToken: null,
    };
    expect(userCanUploadMapLayer(signedOut)).toBe(false);
  });

  it('allows a Super User CREATE_MAP_ASSET_OUTSIDE_TEAM role', () => {
    expect(
      userCanUploadMapLayer(
        user('admin', {
          globalRoles: [Role.GENERAL_USER, Role.GENERAL_ADMIN],
        })
      )
    ).toBe(true);
  });

  it('does not let a content creator upload outside a team', () => {
    expect(
      userCanUploadMapLayer(
        user('creator', {
          globalRoles: [Role.GENERAL_USER, Role.GENERAL_CREATOR],
        })
      )
    ).toBe(false);
  });

  it('allows a team-only CREATE_MAP_ASSET_IN_TEAM role', () => {
    expect(
      userCanUploadMapLayer(
        user('team-creator', {
          resourceRoles: [{resourceId: teamId, role: Role.TEAM_MEMBER_CREATOR}],
        })
      )
    ).toBe(true);
  });

  it('denies a user with neither create action', () => {
    expect(userCanUploadMapLayer(user('member'))).toBe(false);
    expect(
      userCanUploadMapLayer(
        user('member', {
          resourceRoles: [{resourceId: teamId, role: Role.TEAM_MEMBER}],
        })
      )
    ).toBe(false);
  });
});
