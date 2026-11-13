// SPDX-License-Identifier: Apache-2.0
import type {User} from '@/context/auth-provider';
import {Role} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {userCanUpdateSomeProject} from './auth-hooks';

function user(
  overrides: Partial<NonNullable<User['decodedToken']>> = {}
): User {
  return {
    token: 'token',
    refreshToken: 'refresh',
    user: {id: 'u', name: 'User', email: 'u@example.com', isVerified: true},
    decodedToken: {
      username: 'u',
      name: 'User',
      server: 'http://localhost',
      exp: 9e9,
      globalRoles: [],
      resourceRoles: [],
      ...overrides,
    },
  } as User;
}

describe('userCanUpdateSomeProject', () => {
  it('is true for Super Users whose grant is global, not a survey id', () => {
    expect(
      userCanUpdateSomeProject(user({globalRoles: [Role.GENERAL_ADMIN]}))
    ).toBe(true);
  });

  it('is true for a manager of a specific survey', () => {
    expect(
      userCanUpdateSomeProject(
        user({
          resourceRoles: [{resourceId: 'survey-1', role: Role.PROJECT_MANAGER}],
        })
      )
    ).toBe(true);
  });

  it('is true for a team manager whose surveys may not all be in the JWT', () => {
    expect(
      userCanUpdateSomeProject(
        user({
          resourceRoles: [{resourceId: 'team-1', role: Role.TEAM_MANAGER}],
        })
      )
    ).toBe(true);
  });

  it('is false for a guest who cannot change any survey', () => {
    expect(
      userCanUpdateSomeProject(
        user({
          globalRoles: [Role.GENERAL_USER],
          resourceRoles: [{resourceId: 'survey-1', role: Role.PROJECT_GUEST}],
        })
      )
    ).toBe(false);
  });
});
