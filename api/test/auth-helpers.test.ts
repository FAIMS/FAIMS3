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
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: auth-helpers.test.ts
 * Description:
 *   Unit tests for ssoVerify, identifyUser, and applyProvisionPolicy in
 *   auth/helpers.ts. These tests mock all CouchDB and external dependencies
 *   so no real database connection is required.
 */

import {
  ExistingPeopleDBDocument,
  PeopleDBDocument,
  Role,
} from '@faims3/data-model';
import {expect} from 'chai';
import sinon from 'sinon';

// ─── Import modules whose exports we will stub ────────────────────────────────
// We import the modules themselves so sinon can stub their exported functions.
// This works because ts-node compiles to CommonJS, making exports mutable.

import * as usersModule from '../src/couchdb/users';
import * as invitesModule from '../src/couchdb/invites';
import * as teamsModule from '../src/couchdb/teams';
import * as keySigningModule from '../src/auth/keySigning/create';
import * as buildconfig from '../src/buildconfig';

// Import the functions under test — must come after the module imports above
// so that when helpers.ts is loaded, the stubs are already in place on the
// shared module objects.
import {
  applyProvisionPolicy,
  identifyUser,
  ssoVerify,
} from '../src/auth/helpers';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Override PROVISION_SSO_USERS_POLICY for the duration of a test */
function setPolicy(policy: string) {
  (buildconfig as any).PROVISION_SSO_USERS_POLICY = policy;
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

/** A minimal upgraded Express user (returned by upgradeCouchUserToExpressUser) */
const expressUser = {_id: 'user-123', name: 'Test User'};

// ─── identifyUser ─────────────────────────────────────────────────────────────
describe('identifyUser', () => {
  let getCouchUserStub: sinon.SinonStub;

  beforeEach(() => {
    getCouchUserStub = sinon.stub(usersModule, 'getCouchUserFromEmailOrUserId');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('throws when given an empty email list', async () => {
    try {
      await identifyUser([], 'Google');
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('verified email addresses');
    }
  });

  it('includes the strategy name in the no-emails error message', async () => {
    try {
      await identifyUser([], 'MyCustomSAML');
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('MyCustomSAML');
    }
  });

  it('returns undefined when no user matches any email', async () => {
    getCouchUserStub.resolves(null);

    const result = await identifyUser(['nobody@example.com'], 'Google');

    expect(result).to.be.undefined;
  });

  it('returns the matching user when exactly one email matches', async () => {
    const user = buildExistingUser();
    getCouchUserStub.resolves(user);

    const result = await identifyUser(['user@example.com'], 'Google');

    expect(result).to.equal(user);
  });

  it('returns the single underlying user when multiple emails resolve to the same account', async () => {
    const user = buildExistingUser();
    // Both emails resolve to the same user (same _id)
    getCouchUserStub.resolves(user);

    const result = await identifyUser(
      ['user@example.com', 'also@example.com'],
      'Google'
    );

    expect(result).to.equal(user);
    expect(getCouchUserStub.callCount).to.equal(2);
  });

  it('throws when multiple emails match different accounts', async () => {
    const userA = buildExistingUser({_id: 'user-a'});
    const userB = buildExistingUser({_id: 'user-b'});
    getCouchUserStub.onFirstCall().resolves(userA);
    getCouchUserStub.onSecondCall().resolves(userB);

    try {
      await identifyUser(['a@example.com', 'b@example.com'], 'Google');
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('more than one');
    }
  });

  it('includes the strategy name in the multiple-accounts error message', async () => {
    const userA = buildExistingUser({_id: 'user-a'});
    const userB = buildExistingUser({_id: 'user-b'});
    getCouchUserStub.onFirstCall().resolves(userA);
    getCouchUserStub.onSecondCall().resolves(userB);

    try {
      await identifyUser(['a@example.com', 'b@example.com'], 'MyCustomSAML');
      expect.fail('Expected an error to be thrown');
    } catch (err: any) {
      expect(err.message).to.include('MyCustomSAML');
    }
  });

  it('returns the matched user when only one of several emails matches', async () => {
    const user = buildExistingUser();
    getCouchUserStub.onFirstCall().resolves(null);
    getCouchUserStub.onSecondCall().resolves(user);

    const result = await identifyUser(
      ['unknown@example.com', 'user@example.com'],
      'Google'
    );

    expect(result).to.equal(user);
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

  let createUserStub: sinon.SinonStub;
  let createTeamStub: sinon.SinonStub;
  let _saveCouchUserStub: sinon.SinonStub;

  beforeEach(() => {
    createUserStub = sinon.stub(usersModule, 'createUser');
    createTeamStub = sinon.stub(teamsModule, 'createTeamDocument');
    _saveCouchUserStub = sinon.stub(usersModule, 'saveCouchUser');

    // Default: createUser returns a valid new user
    const newUser = buildNewUser();
    createUserStub.resolves([newUser, '']);
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── policy: reject ──────────────────────────────────────────────────────────

  describe('policy: reject', () => {
    beforeEach(() => setPolicy('reject'));

    it('throws without creating a user', async () => {
      try {
        await applyProvisionPolicy(baseArgs);
        expect.fail('Expected an error to be thrown');
      } catch (err: any) {
        expect(err.message).to.include('does not exist in our system');
      }
      expect(createUserStub.called).to.be.false;
    });
  });

  // ── policy: general-user ────────────────────────────────────────────────────

  describe('policy: general-user', () => {
    beforeEach(() => setPolicy('general-user'));

    it('creates a new user', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createUserStub.calledOnce).to.be.true;
    });

    it('adds the GENERAL_USER global role to the new user', async () => {
      const newUser = buildNewUser({globalRoles: []});
      createUserStub.resolves([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.globalRoles).to.include(Role.GENERAL_USER);
    });

    it('does not create a team', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createTeamStub.called).to.be.false;
    });

    it('returns the new user document', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      const result = await applyProvisionPolicy(baseArgs);

      expect(result).to.equal(newUser);
    });

    it('links the SSO profile to the new user', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.profiles['google']).to.equal(baseProfile);
    });

    it('uses the first email as primary email and username', async () => {
      await applyProvisionPolicy({
        ...baseArgs,
        emails: ['first@example.com', 'second@example.com'],
      });

      const callArg = createUserStub.firstCall.args[0];
      expect(callArg.email).to.equal('first@example.com');
      expect(callArg.username).to.equal('first@example.com');
    });

    it('throws when createUser returns null', async () => {
      createUserStub.resolves([null, 'db error']);

      try {
        await applyProvisionPolicy(baseArgs);
        expect.fail('Expected an error to be thrown');
      } catch (err: any) {
        expect(err.message).to.include('unable to create new user');
      }
    });
  });

  // ── policy: own-team ────────────────────────────────────────────────────────

  describe('policy: own-team', () => {
    beforeEach(() => {
      setPolicy('own-team');
      createTeamStub.resolves({_id: 'team-abc'});
    });

    it('creates a new user', async () => {
      await applyProvisionPolicy(baseArgs);

      expect(createUserStub.calledOnce).to.be.true;
    });

    it('creates a personal team named after the user', async () => {
      const newUser = buildNewUser({name: 'Alice'});
      createUserStub.resolves([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(createTeamStub.calledOnce).to.be.true;
      const callArg = createTeamStub.firstCall.args[0];
      expect(callArg.name).to.equal('Personal: Alice');
    });

    it('adds the TEAM_MANAGER team role to the new user', async () => {
      const newUser = buildNewUser({teamRoles: []});
      createUserStub.resolves([newUser, '']);
      createTeamStub.resolves({_id: 'team-abc'});

      await applyProvisionPolicy(baseArgs);

      expect(newUser.teamRoles).to.deep.include({
        resourceId: 'team-abc',
        role: Role.TEAM_MANAGER,
      });
    });

    it('does not call addGlobalRole', async () => {
      const result = await applyProvisionPolicy(baseArgs);

      expect(result.globalRoles).to.be.empty;
    });

    it('returns the new user document', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      const result = await applyProvisionPolicy(baseArgs);

      expect(result).to.equal(newUser);
    });

    it('sets createdBy to the new user id on the team', async () => {
      const newUser = buildNewUser({_id: 'user-xyz'});
      createUserStub.resolves([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      const callArg = createTeamStub.firstCall.args[0];
      expect(callArg.createdBy).to.equal('user-xyz');
    });

    it('links the SSO profile to the new user', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await applyProvisionPolicy(baseArgs);

      expect(newUser.profiles['google']).to.equal(baseProfile);
    });

    it('throws when createUser returns null', async () => {
      createUserStub.resolves([null, 'db error']);

      try {
        await applyProvisionPolicy(baseArgs);
        expect.fail('Expected an error to be thrown');
      } catch (err: any) {
        expect(err.message).to.include('unable to create new user');
      }
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

  let getCouchUserStub: sinon.SinonStub;
  let saveCouchUserStub: sinon.SinonStub;
  let createUserStub: sinon.SinonStub;
  let createTeamStub: sinon.SinonStub;
  let upgradeUserStub: sinon.SinonStub;
  let getInviteStub: sinon.SinonStub;
  let isInviteValidStub: sinon.SinonStub;
  let done: sinon.SinonSpy;

  beforeEach(() => {
    getCouchUserStub = sinon.stub(usersModule, 'getCouchUserFromEmailOrUserId');
    saveCouchUserStub = sinon.stub(usersModule, 'saveCouchUser');
    createUserStub = sinon.stub(usersModule, 'createUser');
    createTeamStub = sinon.stub(teamsModule, 'createTeamDocument');
    upgradeUserStub = sinon.stub(
      keySigningModule,
      'upgradeCouchUserToExpressUser'
    );
    getInviteStub = sinon.stub(invitesModule, 'getInvite');
    isInviteValidStub = sinon.stub(invitesModule, 'isInviteValid');

    // Sensible defaults
    setPolicy('reject'); // safe default — prevents accidental provisioning
    saveCouchUserStub.resolves();
    upgradeUserStub.resolves(expressUser);
    createTeamStub.resolves({_id: 'team-new'});

    done = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── Guard clauses ────────────────────────────────────────────────────────────

  describe('guard clauses', () => {
    it('calls done with error when session has no action', async () => {
      await ssoVerify({...baseArgs, req: buildReq({}), done});

      expect(done.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(user).to.be.undefined;
    });

    it('calls done with error when action is register but no inviteId', async () => {
      await ssoVerify({...baseArgs, req: buildReq({action: 'register'}), done});

      expect(done.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(user).to.be.undefined;
    });

    it('calls done with error when identifyUser throws', async () => {
      getCouchUserStub.rejects(new Error('db connection failure'));

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(done.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err.message).to.include('db connection failure');
      expect(user).to.be.undefined;
    });
  });

  // ── Login: existing user ──────────────────────────────────────────────────────

  describe('login: existing user', () => {
    it('calls done with null error and the upgraded express user', async () => {
      const existingUser = buildExistingUser();
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(done.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.null;
      expect(user).to.equal(expressUser);
    });

    it('links the SSO profile when not already present', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(existingUser.profiles['google']).to.equal(baseProfile);
      expect(saveCouchUserStub.calledWith(existingUser)).to.be.true;
    });

    it('does not overwrite an existing SSO profile link', async () => {
      const existingProfile = {id: 'already-linked'};
      const existingUser = buildExistingUser({
        profiles: {google: existingProfile},
      });
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(existingUser.profiles['google']).to.equal(existingProfile);
      expect(saveCouchUserStub.called).to.be.false;
    });
  });

  // ── Login: unknown user (provisioning) ────────────────────────────────────────

  describe('login: unknown user', () => {
    beforeEach(() => {
      getCouchUserStub.resolves(null);
    });

    it('calls done with error when policy is reject', async () => {
      setPolicy('reject');

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(done.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.include('does not exist in our system');
      expect(user).to.be.undefined;
    });

    it('creates a new user and calls done with success when policy is general-user', async () => {
      setPolicy('general-user');
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(createUserStub.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.null;
      expect(user).to.equal(expressUser);
    });

    it('creates a new user and team and calls done with success when policy is own-team', async () => {
      setPolicy('own-team');
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      expect(createUserStub.calledOnce).to.be.true;
      expect(createTeamStub.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.null;
      expect(user).to.equal(expressUser);
    });

    it('calls done with error when provisioning fails', async () => {
      setPolicy('general-user');
      createUserStub.resolves([null, 'db error']);

      await ssoVerify({...baseArgs, req: buildReq({action: 'login'}), done});

      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.include('unable to create new user');
      expect(user).to.be.undefined;
    });
  });

  // ── Register: new user ────────────────────────────────────────────────────────

  describe('register: new user', () => {
    beforeEach(() => {
      getCouchUserStub.resolves(null);
      getInviteStub.resolves({id: 'invite-1', role: Role.GENERAL_USER});
      isInviteValidStub.returns({isValid: true});
    });

    it('calls done with error when invite does not exist', async () => {
      getInviteStub.resolves(null);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'bad-invite'}),
        done,
      });

      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(user).to.be.undefined;
    });

    it('calls done with error when invite is not valid', async () => {
      isInviteValidStub.returns({isValid: false, reason: 'expired'});

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'expired-invite'}),
        done,
      });

      const [err, user] = done.firstCall.args;
      expect(err).to.be.instanceOf(Error);
      expect(user).to.be.undefined;
    });

    it('creates a new user and calls done with success', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(createUserStub.calledOnce).to.be.true;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.null;
      expect(user).to.equal(expressUser);
    });

    it('links the SSO profile to the newly created user', async () => {
      const newUser = buildNewUser();
      createUserStub.resolves([newUser, '']);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(newUser.profiles['google']).to.equal(baseProfile);
    });
  });

  // ── Register: user already exists (upgrade path) ──────────────────────────────

  describe('register: existing user (login upgrade path)', () => {
    beforeEach(() => {
      getInviteStub.resolves({id: 'invite-1', role: Role.GENERAL_USER});
      isInviteValidStub.returns({isValid: true});
    });

    it('logs in the existing user without creating a new one', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(createUserStub.called).to.be.false;
      const [err, user] = done.firstCall.args;
      expect(err).to.be.null;
      expect(user).to.equal(expressUser);
    });

    it('links the SSO profile to the existing user if not already linked', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(existingUser.profiles['google']).to.equal(baseProfile);
    });

    it('saves the updated existing user', async () => {
      const existingUser = buildExistingUser({profiles: {}});
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({
        ...baseArgs,
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      expect(saveCouchUserStub.calledWith(existingUser)).to.be.true;
    });

    it('adds all verified emails to the existing user', async () => {
      const existingUser = buildExistingUser({
        emails: [{email: 'original@example.com', verified: true}],
        profiles: {},
      });
      getCouchUserStub.resolves(existingUser);

      await ssoVerify({
        ...baseArgs,
        emails: ['user@example.com', 'alt@example.com'],
        req: buildReq({action: 'register', inviteId: 'good-invite'}),
        done,
      });

      const emailValues = existingUser.emails.map((e: any) => e.email);
      expect(emailValues).to.include('user@example.com');
      expect(emailValues).to.include('alt@example.com');
    });
  });
});
