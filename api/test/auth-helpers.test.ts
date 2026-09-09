/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: auth-helpers.test.ts
 * Description:
 *   Unit tests for ssoVerify, identifyUser, and applyProvisionPolicy in
 *   auth/helpers.ts. These tests mock CouchDB dependencies via vi.mock so no
 *   real database connection is required.
 */

import {
  ExistingPeopleDBDocument,
  PeopleDBDocument,
  Role,
} from '@faims3/data-model';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('../src/couchdb/users', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/couchdb/users')>();
  return {
    ...actual,
    getCouchUserFromEmailOrUserId: vi.fn(),
    createUser: vi.fn(),
    saveCouchUser: vi.fn(),
  };
});

vi.mock('../src/couchdb/teams', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/couchdb/teams')>();
  return {
    ...actual,
    createTeamDocument: vi.fn(),
  };
});

import {config} from '../src/buildconfig';
import {
  applyProvisionPolicy,
  identifyUser,
  ssoVerify,
} from '../src/auth/helpers';
import * as teamsModule from '../src/couchdb/teams';
import * as usersModule from '../src/couchdb/users';

const getCouchUserFromEmailOrUserId = vi.mocked(
  usersModule.getCouchUserFromEmailOrUserId
);
const createUser = vi.mocked(usersModule.createUser);
const saveCouchUser = vi.mocked(usersModule.saveCouchUser);
const createTeamDocument = vi.mocked(teamsModule.createTeamDocument);

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Override PROVISION_SSO_USERS_POLICY for the duration of a test */
function setPolicy(policy: string) {
  (config as any).provisionSSOUsersPolicy = policy;
}

/** Build a minimal ExistingPeopleDBDocument */
function buildExistingUser(
  overrides: Partial<ExistingPeopleDBDocument> = {}
): ExistingPeopleDBDocument {
  return {
    _id: 'user-123',
    _rev: 'rev-1',
    name: 'Test User',
    emails: [{email: 'user@example.com', verified: true}],
    profiles: {},
    roles: [],
    globalRoles: [],
    teamRoles: [],
    projectRoles: [],
    templateRoles: [],
    ...overrides,
  } as unknown as ExistingPeopleDBDocument;
}

/** Build a minimal PeopleDBDocument (not yet saved to DB) */
function buildNewUser(
  overrides: Partial<PeopleDBDocument> = {}
): PeopleDBDocument {
  return {
    _id: 'new-user-456',
    name: 'New User',
    emails: [{email: 'new@example.com', verified: true}],
    profiles: {},
    roles: [],
    globalRoles: [],
    projectRoles: [],
    teamRoles: [],
    templateRoles: [],
    ...overrides,
  } as unknown as PeopleDBDocument;
}

/** Build a mock Express.Request with the given session data */
function buildReq(session: Record<string, unknown> = {}): Express.Request {
  return {session} as unknown as Express.Request;
}

/** A simple displayName extractor */
const displayNameFn = (profile: any): string =>
  profile.displayName ?? 'Test User';

/** A minimal SSO profile */
const baseProfile = {id: 'sso-id-1', displayName: 'Test User'};

function resetAuthMocks() {
  getCouchUserFromEmailOrUserId.mockReset();
  createUser.mockReset();
  saveCouchUser.mockReset();
  createTeamDocument.mockReset();
}

// ─── identifyUser ─────────────────────────────────────────────────────────────
describe('identifyUser', () => {
  beforeEach(() => {
    resetAuthMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws when given an empty email list', async () => {
    await expect(identifyUser([], 'Google')).rejects.toThrow(
      'verified email addresses'
    );
  });

  it('includes the strategy name in the no-emails error message', async () => {
    await expect(identifyUser([], 'MyCustomSAML')).rejects.toThrow(
      'MyCustomSAML'
    );
  });

  it('returns undefined when no user matches any email', async () => {
    getCouchUserFromEmailOrUserId.mockResolvedValue(null);

    const result = await identifyUser(['nobody@example.com'], 'Google');

    expect(result).toBeUndefined();
  });

  it('returns the matching user when exactly one email matches', async () => {
    const user = buildExistingUser();
    getCouchUserFromEmailOrUserId.mockResolvedValue(user);

    const result = await identifyUser(['user@example.com'], 'Google');

    expect(result).toBe(user);
  });

  it('returns the single underlying user when multiple emails resolve to the same account', async () => {
    const user = buildExistingUser();
    getCouchUserFromEmailOrUserId.mockResolvedValue(user);

    const result = await identifyUser(
      ['user@example.com', 'also@example.com'],
      'Google'
    );

    expect(result).toBe(user);
    expect(getCouchUserFromEmailOrUserId).toHaveBeenCalledTimes(2);
  });

  it('throws when multiple emails match different accounts', async () => {
    const userA = buildExistingUser({_id: 'user-a'});
    const userB = buildExistingUser({_id: 'user-b'});
    getCouchUserFromEmailOrUserId
      .mockResolvedValueOnce(userA)
      .mockResolvedValueOnce(userB);

    await expect(
      identifyUser(['a@example.com', 'b@example.com'], 'Google')
    ).rejects.toThrow('more than one');
  });

  it('includes the strategy name in the multiple-accounts error message', async () => {
    const userA = buildExistingUser({_id: 'user-a'});
    const userB = buildExistingUser({_id: 'user-b'});
    getCouchUserFromEmailOrUserId
      .mockResolvedValueOnce(userA)
      .mockResolvedValueOnce(userB);

    await expect(
      identifyUser(['a@example.com', 'b@example.com'], 'MyCustomSAML')
    ).rejects.toThrow('MyCustomSAML');
  });

  it('returns the matched user when only one of several emails matches', async () => {
    const user = buildExistingUser();
    getCouchUserFromEmailOrUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user);

    const result = await identifyUser(
      ['unknown@example.com', 'user@example.com'],
      'Google'
    );

    expect(result).toBe(user);
  });
});

// ─── applyProvisionPolicy ─────────────────────────────────────────────────────

describe('applyProvisionPolicy', () => {
  const baseArgs = {
    emails: ['new@example.com'],
    profile: baseProfile,
    strategyId: 'google',
    userDisplayName: displayNameFn,
  };

  beforeEach(() => {
    resetAuthMocks();
    saveCouchUser.mockResolvedValue(undefined as any);
    createUser.mockResolvedValue([buildNewUser(), '']);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('policy: reject', () => {
    beforeEach(() => setPolicy('reject'));

    it('throws without creating a user', async () => {
      await expect(applyProvisionPolicy(baseArgs)).rejects.toThrow(
        'does not exist in our system'
      );
      expect(createUser).not.toHaveBeenCalled();
    });
  });

  describe('policy: general-user', () => {
    beforeEach(() => setPolicy('general-user'));

    it('creates a new user', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createUser).toHaveBeenCalledTimes(1);
    });

    it('adds the GENERAL_USER global role to the new user', async () => {
      const newUser = buildNewUser({globalRoles: []});
      createUser.mockResolvedValue([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.globalRoles).toContain(Role.GENERAL_USER);
    });

    it('does not create a team', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createTeamDocument).not.toHaveBeenCalled();
    });

    it('returns the new user document', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      const result = await applyProvisionPolicy(baseArgs);

      expect(result).toBe(newUser);
    });

    it('links the SSO profile to the new user', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.profiles['google']).toBe(baseProfile);
    });

    it('uses the first email as primary email and username', async () => {
      await applyProvisionPolicy({
        ...baseArgs,
        emails: ['first@example.com', 'second@example.com'],
      });

      const callArg = createUser.mock.calls[0][0];
      expect(callArg.email).toBe('first@example.com');
      expect(callArg.username).toBe('first@example.com');
    });

    it('throws when createUser returns null', async () => {
      createUser.mockResolvedValue([null, 'db error']);

      await expect(applyProvisionPolicy(baseArgs)).rejects.toThrow(
        'unable to create new user'
      );
    });
  });

  describe('policy: own-team', () => {
    beforeEach(() => {
      setPolicy('own-team');
      createTeamDocument.mockResolvedValue({_id: 'team-abc'} as any);
    });

    it('creates a new user', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createUser).toHaveBeenCalledTimes(1);
    });

    it('creates a personal team named after the user', async () => {
      const newUser = buildNewUser({name: 'Alice'});
      createUser.mockResolvedValue([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(createTeamDocument).toHaveBeenCalledTimes(1);
      const callArg = createTeamDocument.mock.calls[0][0];
      expect(callArg.name).toBe('Personal: Alice');
    });

    it('adds the TEAM_MANAGER team role to the new user', async () => {
      const newUser = buildNewUser({teamRoles: []});
      createUser.mockResolvedValue([newUser, '']);
      createTeamDocument.mockResolvedValue({_id: 'team-abc'} as any);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.teamRoles).toContainEqual({
        resourceId: 'team-abc',
        role: Role.TEAM_MANAGER,
      });
    });

    it('does not call addGlobalRole', async () => {
      const result = await applyProvisionPolicy(baseArgs);

      expect(result.globalRoles).toHaveLength(0);
    });

    it('returns the new user document', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      const result = await applyProvisionPolicy(baseArgs);

      expect(result).toBe(newUser);
    });

    it('sets createdBy to the new user id on the team', async () => {
      const newUser = buildNewUser({_id: 'user-xyz'});
      createUser.mockResolvedValue([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      const callArg = createTeamDocument.mock.calls[0][0];
      expect(callArg.createdBy).toBe('user-xyz');
    });

    it('links the SSO profile to the new user', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.profiles['google']).toBe(baseProfile);
    });

    it('throws when createUser returns null', async () => {
      createUser.mockResolvedValue([null, 'db error']);

      await expect(applyProvisionPolicy(baseArgs)).rejects.toThrow(
        'unable to create new user'
      );
    });
  });
});

// ─── ssoVerify ────────────────────────────────────────────────────────────────

describe('ssoVerify', () => {
  const baseArgs = {
    strategyId: 'google',
    strategyName: 'Google',
    profile: baseProfile,
    emails: ['user@example.com'],
    userDisplayName: displayNameFn,
  };

  type DoneFn = (error: any, user?: any, info?: any) => void;
  let done: ReturnType<typeof vi.fn<DoneFn>>;

  beforeEach(() => {
    resetAuthMocks();
    setPolicy('reject');
    saveCouchUser.mockResolvedValue(undefined as any);
    createTeamDocument.mockResolvedValue({_id: 'team-new'} as any);
    done = vi.fn<DoneFn>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('guard clauses', () => {
    it('calls done with error when session has no action', async () => {
      await ssoVerify({
        ...baseArgs,
        req: buildReq({}),
        done,
      });

      expect(done).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(user).toBeUndefined();
    });

    it('calls done with error when action is register but no inviteId', async () => {
      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register'}),
        done,
      });

      expect(done).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(user).toBeUndefined();
    });

    it('calls done with error when identifyUser throws', async () => {
      getCouchUserFromEmailOrUserId.mockRejectedValue(
        new Error('db connection failure')
      );

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(done).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err.message).toContain('db connection failure');
      expect(user).toBeUndefined();
    });
  });

  describe('login: existing user', () => {
    it('calls done with null error and the raw db user', async () => {
      const existingUser = buildExistingUser();
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(done).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeNull();
      expect(user).toBe(existingUser);
    });

    it('links the SSO profile when not already present', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(existingUser.profiles['google']).toBe(baseProfile);
      expect(saveCouchUser).toHaveBeenCalledWith(existingUser);
    });

    it('does not overwrite an existing SSO profile link', async () => {
      const existingProfile = {id: 'already-linked'};
      const existingUser = buildExistingUser({
        profiles: {google: existingProfile},
      });
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(existingUser.profiles['google']).toBe(existingProfile);
      expect(saveCouchUser).not.toHaveBeenCalled();
    });
  });

  describe('login: unknown user', () => {
    beforeEach(() => {
      getCouchUserFromEmailOrUserId.mockResolvedValue(null);
    });

    it('calls done with error when policy is reject', async () => {
      setPolicy('reject');

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(done).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('does not exist in our system');
      expect(user).toBeUndefined();
    });

    it('creates a new user and calls done with success when policy is general-user', async () => {
      setPolicy('general-user');
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(createUser).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeNull();
      expect(user).toBe(newUser);
    });

    it('creates a new user and team and calls done with success when policy is own-team', async () => {
      setPolicy('own-team');
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      expect(createUser).toHaveBeenCalledTimes(1);
      expect(createTeamDocument).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeNull();
      expect(user).toBe(newUser);
    });

    it('calls done with error when provisioning fails', async () => {
      setPolicy('general-user');
      createUser.mockResolvedValue([null, 'db error']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'login'}),
        done,
      });

      const [err, user] = done.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('unable to create new user');
      expect(user).toBeUndefined();
    });
  });

  describe('register: new user', () => {
    beforeEach(() => {
      getCouchUserFromEmailOrUserId.mockResolvedValue(null);
    });

    it('creates a new user and calls done with success', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(createUser).toHaveBeenCalledTimes(1);
      const [err, user] = done.mock.calls[0];
      expect(err).toBeNull();
      expect(user).toBe(newUser);
    });

    it('links the SSO profile to the newly created user', async () => {
      const newUser = buildNewUser();
      createUser.mockResolvedValue([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(newUser.profiles['google']).toBe(baseProfile);
    });
  });

  describe('register: existing user (login upgrade path)', () => {
    it('logs in the existing user without creating a new one', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(createUser).not.toHaveBeenCalled();
      const [err, user] = done.mock.calls[0];
      expect(err).toBeNull();
      expect(user).toBe(existingUser);
    });

    it('links the SSO profile to the existing user if not already linked', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(existingUser.profiles['google']).toBe(baseProfile);
    });

    it('saves the updated existing user', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(saveCouchUser).toHaveBeenCalledWith(existingUser);
    });

    it('adds all verified emails to the existing user', async () => {
      const existingUser = buildExistingUser({
        emails: [{email: 'original@example.com', verified: true}],
        profiles: {},
      });
      getCouchUserFromEmailOrUserId.mockResolvedValue(existingUser);

      await ssoVerify({
        ...baseArgs,
        emails: ['user@example.com', 'alt@example.com'],
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      const emailValues = existingUser.emails.map((e: any) => e.email);
      expect(emailValues).toContain('user@example.com');
      expect(emailValues).toContain('alt@example.com');
    });
  });
});
