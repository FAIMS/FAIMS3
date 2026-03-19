/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Unit tests for record-level authorization helpers.
 */

import {Role} from '@faims3/data-model';
import {expect} from 'chai';
import {
  canDeleteRecord,
  canEditRecord,
  canReadRecord,
} from '../src/recordAuth';

const projectId = 'test-project-id';

function makeUser(
  userId: string,
  projectRole: Role
): globalThis.Express.User {
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
      ).to.be.true;
    });

    it('denies PROJECT_GUEST from reading another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.false;
    });

    it('allows PROJECT_CONTRIBUTOR to read own record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).to.be.true;
    });

    it('allows PROJECT_CONTRIBUTOR to read another user record', () => {
      const user = makeUser('alice', Role.PROJECT_CONTRIBUTOR);
      expect(
        canReadRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.true;
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
      ).to.be.true;
    });

    it('denies PROJECT_GUEST from editing another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.false;
    });

    it('allows PROJECT_GUEST to edit own record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).to.be.true;
    });

    it('allows PROJECT_ADMIN to edit another user record', () => {
      const user = makeUser('alice', Role.PROJECT_ADMIN);
      expect(
        canEditRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.true;
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
      ).to.be.true;
    });

    it('allows PROJECT_GUEST to delete own record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'alice',
        })
      ).to.be.true;
    });

    it('denies PROJECT_GUEST from deleting another user record', () => {
      const user = makeUser('alice', Role.PROJECT_GUEST);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.false;
    });

    it('allows PROJECT_ADMIN to delete another user record', () => {
      const user = makeUser('alice', Role.PROJECT_ADMIN);
      expect(
        canDeleteRecord({
          user,
          projectId,
          createdBy: 'bob',
        })
      ).to.be.true;
    });
  });
});
