// SPDX-License-Identifier: Apache-2.0

/*
 * Unit tests for record-level authorization helpers.
 * Records API routes that mutate existing records (PUT record, POST …/revisions)
 * use canEditRecord after project-level edit checks.
 */

import {Role} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {canDeleteRecord, canEditRecord, canReadRecord} from '../src/recordAuth';

const projectId = 'test-project-id';

function makeUser(userId: string, projectRole: Role): globalThis.Express.User {
  return {
    user_id: userId,
    globalRoles: [],
    resourceRoles: [{role: projectRole, resourceId: projectId}],
  } as unknown as globalThis.Express.User;
}

describe('recordAuth', () => {
  describe('canReadRecord', () => {
    it('allows PROJECT_GUEST to read own record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('denies PROJECT_GUEST from reading another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(false);
    });

    it('allows PROJECT_CONTRIBUTOR to read own record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('allows PROJECT_CONTRIBUTOR to read another user record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(true);
    });
  });

  describe('canEditRecord', () => {
    it('allows PROJECT_CONTRIBUTOR to edit own record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('denies PROJECT_GUEST from editing another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(false);
    });

    it('allows PROJECT_GUEST to edit own record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('allows PROJECT_ADMIN to edit another user record', () => {
      const user = makeUser('alice', Role.PROJECT_ADMIN);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(true);
    });

    it('allows PROJECT_CONTRIBUTOR to edit another user record (EDIT_ALL)', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(true);
    });

    it('allows PROJECT_MANAGER to edit another user record (inherits contributor)', () => {
      const user = makeUser('alice', Role.PROJECT_MANAGER);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(true);
    });
  });

  describe('canDeleteRecord', () => {
    it('allows PROJECT_CONTRIBUTOR to delete own record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('allows PROJECT_GUEST to delete own record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).toBe(true);
    });

    it('denies PROJECT_GUEST from deleting another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(false);
    });

    it('allows PROJECT_ADMIN to delete another user record', () => {
      const user = makeUser('alice', Role.PROJECT_ADMIN);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).toBe(true);
    });
  });
});
