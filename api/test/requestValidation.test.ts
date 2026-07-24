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
 * Description:
 *   Asserts express-zod-safe request validation across body, query, and
 *   params, including the capitalised error envelope and missing-schema
 *   behaviour (`any`). Protected routes are exercised with authenticated
 *   callers so validation runs after auth (auth → validate).
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import {PostCreateTeamResponse, Role} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {createNotebook} from '../src/couchdb/notebooks';
import {app} from '../src/expressSetup';
import {EMPTY_UI_SPECIFICATION} from './sampleNotebook';
import {adminToken, beforeApiTests, requestAuthAndType} from './utils';

const createTeam = async (
  name = 'Validation Team'
): Promise<PostCreateTeamResponse> => {
  const response = await requestAuthAndType(
    request(app).post('/api/teams').send({
      name,
      description: 'team for request validation tests',
    }),
    adminToken
  ).expect(200);
  return response.body as PostCreateTeamResponse;
};

type ValidationAspect = 'Body' | 'Query' | 'Params';

type ValidationErrorItem = {
  type: ValidationAspect;
  errors: {
    name: string;
    message: string;
    issues: Array<{message: string; path?: unknown[]; code?: string}>;
  };
};

const expectValidationError = (
  body: unknown,
  aspect: ValidationAspect,
  messageSubstring?: string | RegExp
): ValidationErrorItem => {
  expect(body).to.be.an('array').that.is.not.empty;
  const items = body as ValidationErrorItem[];
  const match = items.find(item => item.type === aspect);
  expect(match, `expected a ${aspect} validation error`).to.exist;
  expect(match!.errors).to.include.keys('name', 'message', 'issues');
  expect(match!.errors.issues).to.be.an('array').that.is.not.empty;
  if (messageSubstring !== undefined) {
    const messages = match!.errors.issues.map(i => i.message).join('\n');
    if (typeof messageSubstring === 'string') {
      expect(messages).to.include(messageSubstring);
    } else {
      expect(messages).to.match(messageSubstring);
    }
  }
  return match!;
};

describe('Request validation (express-zod-safe)', () => {
  beforeEach(beforeApiTests);

  describe('Body', () => {
    it('rejects create-team payloads that fail the body schema', async () => {
      const response = await requestAuthAndType(
        request(app).post('/api/teams').send({
          name: 'ab', // min length 5
          description: 'ok',
        }),
        adminToken
      ).expect(400);

      expectValidationError(
        response.body,
        'Body',
        'Team name is required, minimum length 5'
      );
      expect(response.body).to.have.lengthOf(1);
    });

    it('rejects long-lived token create payloads missing required fields', async () => {
      const response = await requestAuthAndType(
        request(app).post('/api/long-lived-tokens').send({
          title: 'Missing description',
        }),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Body');
    });

    it('rejects token exchange payloads with an empty exchangeToken', async () => {
      // Public endpoint — no auth gate; validate is the first check.
      const response = await request(app)
        .post('/api/auth/exchange')
        .send({exchangeToken: ''})
        .expect(400);

      expectValidationError(response.body, 'Body');
    });

    it('rejects team membership payloads that fail refine rules', async () => {
      const team = await createTeam('Validation Team');

      const response = await requestAuthAndType(
        request(app).post(`/api/teams/${team._id}/members`).send({
          username: 'someone',
          action: 'ADD_ROLE',
          // role omitted — refine requires it for ADD_ROLE
        }),
        adminToken
      ).expect(400);

      expectValidationError(
        response.body,
        'Body',
        'Must specify a role if removing or adding a role'
      );
    });

    it('rejects invite create with a non resource-specific role', async () => {
      // Auth first; Zod body refine fails before the in-handler permission check.
      const response = await requestAuthAndType(
        request(app).post('/api/invites/team/team-1').send({
          role: Role.GENERAL_CREATOR,
          name: 'bad invite',
        }),
        adminToken
      ).expect(400);

      expectValidationError(
        response.body,
        'Body',
        'Role must be a resource specific role'
      );
    });
  });

  describe('Query', () => {
    it('rejects invalid includeArchived values on notebook list', async () => {
      const response = await requestAuthAndType(
        request(app).get('/api/notebooks').query({includeArchived: 'yes'}),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Query');
      expect(response.body).to.have.lengthOf(1);
    });

    it('rejects invalid includeArchived values on template list', async () => {
      const response = await requestAuthAndType(
        request(app).get('/api/templates').query({includeArchived: '1'}),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Query');
    });

    it('rejects invalid filterDeleted on record metadata list', async () => {
      const projectId = await createNotebook({
        projectName: 'validation-records',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      const response = await requestAuthAndType(
        request(app)
          .get(`/api/notebooks/${projectId}/records/metadata`)
          .query({filterDeleted: 'maybe'}),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Query');
    });

    it('rejects out-of-range limit on record metadata list', async () => {
      const projectId = await createNotebook({
        projectName: 'validation-limit',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      const response = await requestAuthAndType(
        request(app)
          .get(`/api/notebooks/${projectId}/records/metadata`)
          .query({limit: '9999'}),
        adminToken
      ).expect(400);

      expectValidationError(
        response.body,
        'Query',
        'limit must be between 1 and 500'
      );
    });

    it('accepts valid optional query enums', async () => {
      await requestAuthAndType(
        request(app).get('/api/notebooks').query({includeArchived: 'false'}),
        adminToken
      ).expect(200);
    });
  });

  describe('Params', () => {
    it('rejects deprecated export routes with an unsupported format', async () => {
      const projectId = await createNotebook({
        projectName: 'validation-export',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      const response = await requestAuthAndType(
        request(app).get(`/api/notebooks/${projectId}/records/FormA.xlsx`),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Params');
    });

    it('accepts deprecated export routes with an allowed format enum', async () => {
      const projectId = await createNotebook({
        projectName: 'validation-export-ok',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      // Format validates; handler may 404 if FormA is not in the UI spec
      const response = await requestAuthAndType(
        request(app).get(`/api/notebooks/${projectId}/records/FormA.csv`),
        adminToken
      );

      expect(response.status).to.not.equal(400);
      expect(response.body).to.not.be.an('array');
    });
  });

  describe('Combined aspects', () => {
    it('validates body on a params+body route without rejecting valid params', async () => {
      const team = await createTeam('Update Body Team');

      const response = await requestAuthAndType(
        request(app).put(`/api/teams/${team._id}`).send({
          name: 'x', // too short
        }),
        adminToken
      ).expect(400);

      expectValidationError(
        response.body,
        'Body',
        'Team name is required, minimum length 5'
      );
      expect(
        (response.body as ValidationErrorItem[]).some(e => e.type === 'Params')
      ).to.be.false;
    });

    it('validates query on a params+query route without rejecting valid params', async () => {
      const projectId = await createNotebook({
        projectName: 'validation-combo',
        uiSpecification: EMPTY_UI_SPECIFICATION,
        description: '',
        createdBy: 'admin',
      });

      const response = await requestAuthAndType(
        request(app)
          .get(`/api/notebooks/${projectId}/records/metadata`)
          .query({filterDeleted: 'nope'}),
        adminToken
      ).expect(400);

      expectValidationError(response.body, 'Query');
      expect(
        (response.body as ValidationErrorItem[]).some(e => e.type === 'Params')
      ).to.be.false;
    });
  });

  describe('Missing-schema behaviour', () => {
    it('does not reject URL params when only the body schema is declared', async () => {
      // validate({body}) must not treat :tokenId as an unrecognized params key
      // (missingSchemaBehavior: 'any'). Handler may still 404.
      const response = await requestAuthAndType(
        request(app)
          .put('/api/long-lived-tokens/token_does_not_exist')
          .send({title: 'Still Valid Shape'}),
        adminToken
      );

      expect(response.status).to.not.equal(400);
      expect(response.body).to.not.be.an('array');
    });

    it('does not reject query strings when only the body schema is declared', async () => {
      const response = await requestAuthAndType(
        request(app).post('/api/teams').query({extra: 'ignored'}).send({
          name: 'Valid Team Name',
          description: 'created while query has extras',
        }),
        adminToken
      ).expect(200);

      expect(response.body).to.have.property('_id');
    });
  });

  describe('Error envelope', () => {
    it('returns capitalised type and Zod issues under errors.issues', async () => {
      const response = await requestAuthAndType(
        request(app).post('/api/teams').send({
          name: 'no',
          description: 'x',
        }),
        adminToken
      ).expect(400);

      const item = expectValidationError(response.body, 'Body');
      expect(item.type).to.equal('Body');
      expect(item.errors.name).to.equal('ZodError');
      expect(item.errors.issues[0]).to.include.keys('message', 'code');
    });
  });
});
