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
 * Integration tests for the stateless CRUD records API.
 * Uses test/fixtures/recordsApi for backup helpers and shared constants.
 *
 * Mutation suites use describeMutations so they run only when
 * ENABLE_RECORDS_CRUD_MUTATIONS is true in the application under test.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {
  addProjectRole,
  GetListRecordsResponse,
  GetRecordResponse,
  ListRecordsItem,
  PatchUpdateRecordInput,
  PatchUpdateRecordResponse,
  PostCreateRecordInput,
  PostCreateRecordResponse,
  PostCreateRevisionInput,
  PostCreateRevisionResponse,
  registerClient,
  Role,
} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {generateJwtFromUser} from '../src/auth/keySigning/create';
import {KEY_SERVICE} from '../src/buildconfig';
import {
  getCouchUserFromEmailOrUserId,
  getExpressUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {ENABLE_RECORDS_CRUD_MUTATIONS} from '../src/api/records';
import {app} from '../src/expressSetup';
import {
  BACKUP_FORM_IDS,
  RECORD_ID_PREFIX,
  RECORDS_BACKUP_PROJECT_ID,
  REVISION_ID_PREFIX,
  withRecordsBackup,
} from './fixtures/recordsApi';

/** Wraps mutation-related describes; skipped while the API ships read-only. */
const describeMutations = ENABLE_RECORDS_CRUD_MUTATIONS
  ? describe
  : describe.skip;
import {callbackObject} from './mocks';
import {
  beforeApiTests,
  localUserName,
  localUserToken,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

describe('Records CRUD API', () => {
  beforeEach(beforeApiTests);

  describe('list records', () => {
    it('returns permission-filtered list after restore', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);

        const body = res.body as GetListRecordsResponse;
        expect(body).to.have.property('records');
        expect(body.records).to.be.an('array');
        expect(body.records.length).to.be.greaterThan(0);

        const first = body.records[0] as ListRecordsItem;
        expect(first).to.have.property('recordId');
        expect(first).to.have.property('revisionId');
        expect(first).to.have.property('createdBy');
        expect(first).to.have.property('type');
      });
    });

    it('accepts filterDeleted query', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({filterDeleted: 'true'})
        ).expect(200);
      });
    });

    it('filters by formId when provided', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const body = res.body as GetListRecordsResponse;
        expect(body.records).to.be.an('array');
        body.records.forEach((r: ListRecordsItem) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
        });
      });
    });

    it('applies limit when provided', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`).query({limit: 3})
        ).expect(200);
        const body = res.body as GetListRecordsResponse;
        expect(body.records.length).to.be.at.most(3);
      });
    });

    it('returns 400 when limit is greater than 500', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`).query({limit: 501})
        ).expect(400);
      });
    });

    it('applies startKey for pagination (returns records after cursor)', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`).query({limit: 5})
        ).expect(200);
        const fullBody = full.body as GetListRecordsResponse;
        if (fullBody.records.length < 2) return;
        const cursor = fullBody.records[1].recordId;
        const res = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({limit: 10, startKey: cursor})
        ).expect(200);
        const body = res.body as GetListRecordsResponse;
        expect(body.records.every((r: ListRecordsItem) => r.recordId > cursor))
          .to.be.true;
      });
    });

    it('regression: list honors formId, limit, and startKey (params were previously ignored)', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2, limit: 5})
        ).expect(200);
        const fullBody = full.body as GetListRecordsResponse;
        expect(fullBody.records.length).to.be.at.most(5);
        fullBody.records.forEach((r: ListRecordsItem) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
        });
        if (fullBody.records.length < 2) return;
        const cursor = fullBody.records[1].recordId;
        const page2 = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`).query({
            formId: BACKUP_FORM_IDS.FORM2,
            limit: 2,
            startKey: cursor,
          })
        ).expect(200);
        const page2Body = page2.body as GetListRecordsResponse;
        expect(page2Body.records.length).to.be.at.most(2);
        page2Body.records.forEach((r: ListRecordsItem) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
          expect(r.recordId > cursor).to.be.true;
        });
      });
    });
  });

  describeMutations('create record', () => {
    it('creates record and returns recordId and revisionId', async () => {
      await withRecordsBackup(async projectId => {
        const body: PostCreateRecordInput = {
          formId: BACKUP_FORM_IDS.FORM2,
          createdBy: 'admin',
        };

        const res = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send(body)
        ).expect(201);

        const created = res.body as PostCreateRecordResponse;
        expect(created.recordId).to.match(new RegExp(`^${RECORD_ID_PREFIX}`));
        expect(created.revisionId).to.match(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );

        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${created.recordId}`)
        ).expect(200);

        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.formId).to.equal(BACKUP_FORM_IDS.FORM2);
        expect(getBody.revisionId).to.equal(created.revisionId);
        expect(getBody).to.have.property('data');
      });
    });

    it('uses token user when createdBy omitted', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records`)
            .send({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(201);

        const created = res.body as PostCreateRecordResponse;
        expect(created).to.have.property('recordId');

        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${created.recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).to.be.an('object');
      });
    });

    it('returns 401 without auth', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .post(`/api/notebooks/${projectId}/records`)
          .set('Content-Type', 'application/json')
          .send({formId: BACKUP_FORM_IDS.FORM2})
          .expect(401);
      });
    });

    it('returns 400 when formId is missing', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({})
        ).expect(400);
      });
    });

    it('creates record with optional relationship', async () => {
      await withRecordsBackup(async projectId => {
        const parentRes = await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records`)
            .send({formId: BACKUP_FORM_IDS.FORM2, createdBy: 'admin'})
        ).expect(201);
        const parent = parentRes.body as PostCreateRecordResponse;

        const body: PostCreateRecordInput = {
          formId: BACKUP_FORM_IDS.FORM2,
          createdBy: 'admin',
          relationship: {
            parent: [
              {
                recordId: parent.recordId,
                fieldId: 'parent-field',
                relationTypeVocabPair: ['relation', 'type'],
              },
            ],
          },
        };
        const res = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send(body)
        ).expect(201);
        const created = res.body as PostCreateRecordResponse;
        expect(created.recordId).to.match(new RegExp(`^${RECORD_ID_PREFIX}`));
        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${created.recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).to.be.an('object');
      });
    });
  });

  describe('get one record', () => {
    it('returns full form data for existing record', async () => {
      await withRecordsBackup(async projectId => {
        const listRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);
        const records = (listRes.body as GetListRecordsResponse).records;
        const sample = records.find((r: ListRecordsItem) => r.createdBy === 'admin');
        if (!sample) throw new Error('expected an admin-owned record in backup');
        const {recordId} = sample;

        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);

        const body = res.body as GetRecordResponse;
        expect(body).to.have.property('formId');
        expect(body).to.have.property('revisionId');
        expect(body).to.have.property('data');
        expect(body).to.have.property('context');
      });
    });

    it('returns 404 for missing record', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).get(
            `/api/notebooks/${projectId}/records/rec-nonexistent-0000000000000000`
          )
        ).expect(404);
      });
    });

    it('returns 401 without auth', async () => {
      await withRecordsBackup(async projectId => {
        await request(app).get(`/api/notebooks/${projectId}/records/metadata`).expect(401);
      });
    });

  });

  describeMutations('get one record (revision pinning via update)', () => {
    it('returns specific revision when revisionId query provided', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId: rev1} =
          createRes.body as PostCreateRecordResponse;

        const updateRes = await requestAuthAndType(
          request(app)
            .put(`/api/notebooks/${projectId}/records/${recordId}`)
            .send({
              revisionId: rev1,
              update: {hridFORM2: {data: 'UpdatedValue', attachments: []}},
              mode: 'new',
            })
        ).expect(200);
        const revisionId2 = (updateRes.body as PatchUpdateRecordResponse)
          .revisionId;

        const getHead = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        const headBody = getHead.body as GetRecordResponse;
        expect(headBody.revisionId).to.equal(revisionId2);
        expect(headBody.data.hridFORM2?.data).to.equal('UpdatedValue');

        const getRev1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId: rev1})
        ).expect(200);
        const bodyRev1 = getRev1.body as GetRecordResponse;
        expect(bodyRev1.revisionId).to.equal(rev1);
        expect(bodyRev1.formId).to.equal(BACKUP_FORM_IDS.FORM2);
        expect(bodyRev1.data).to.be.an('object');
      });
    });
  });

  describeMutations('update record', () => {
    it('updates with partial field data (field-level)', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        const updateBody: PatchUpdateRecordInput = {
          revisionId,
          update: {
            hridFORM2: {
              data: 'Element: Test-00001',
              attachments: [],
            },
          },
          mode: 'new',
        };

        const updateRes = await requestAuthAndType(
          request(app).put(`/api/notebooks/${projectId}/records/${recordId}`).send(updateBody)
        ).expect(200);

        const updated = updateRes.body as PatchUpdateRecordResponse;
        expect(updated).to.have.property('revisionId');
        expect(updated.revisionId).to.match(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );
        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.data.hridFORM2?.data).to.equal('Element: Test-00001');
      });
    });

    it('returns 401 when user has no project-level edit permission', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        const updateBody: PatchUpdateRecordInput = {
          revisionId,
          update: {hridFORM2: {data: 'x', attachments: []}},
        };

        await requestAuthAndType(
          request(app).put(`/api/notebooks/${projectId}/records/${recordId}`).send(updateBody),
          localUserToken
        ).expect(401);
      });
    });

    it('returns 400 when revisionId does not belong to record', async () => {
      await withRecordsBackup(async projectId => {
        const createA = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const createB = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId: recordIdA} = createA.body as PostCreateRecordResponse;
        const {revisionId: revisionIdB} =
          createB.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .put(`/api/notebooks/${projectId}/records/${recordIdA}`)
            .send({
              revisionId: revisionIdB,
              update: {hridFORM2: {data: 'x', attachments: []}},
            })
        ).expect(400);
      });
    });
  });

  describeMutations('create revision (fork)', () => {
    it('creates a new head revision copying AVPs from the given revision', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId: baseRev} =
          createRes.body as PostCreateRecordResponse;

        const forkRes = await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records/${recordId}/revisions`)
            .send({revisionId: baseRev} satisfies PostCreateRevisionInput)
        ).expect(201);

        const forked = forkRes.body as PostCreateRevisionResponse;
        expect(forked.revisionId).to.match(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );
        expect(forked.revisionId).to.not.equal(baseRev);

        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.revisionId).to.equal(forked.revisionId);
        expect(getBody.context.revision.parents).to.deep.equal([baseRev]);
      });
    });

    it('allows default PUT parent mode on the forked revision', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId: baseRev} =
          createRes.body as PostCreateRecordResponse;

        const forkRes = await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records/${recordId}/revisions`)
            .send({revisionId: baseRev})
        ).expect(201);
        const {revisionId: forkRev} =
          forkRes.body as PostCreateRevisionResponse;

        await requestAuthAndType(
          request(app)
            .put(`/api/notebooks/${projectId}/records/${recordId}`)
            .send({
              revisionId: forkRev,
              update: {hridFORM2: {data: 'ForkedParentEdit', attachments: []}},
            })
        ).expect(200);

        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        expect(
          (getRes.body as GetRecordResponse).data.hridFORM2?.data
        ).to.equal('ForkedParentEdit');
      });
    });

    it('returns 401 without auth', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        await request(app)
          .post(`/api/notebooks/${projectId}/records/${recordId}/revisions`)
          .set('Content-Type', 'application/json')
          .send({revisionId})
          .expect(401);
      });
    });

    it('returns 401 when user has no project-level edit permission', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records/${recordId}/revisions`)
            .send({revisionId}),
          localUserToken
        ).expect(401);
      });
    });

    it('returns 400 when revision belongs to a different record', async () => {
      await withRecordsBackup(async projectId => {
        const createA = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const createB = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId: recordIdA} = createA.body as PostCreateRecordResponse;
        const {revisionId: revisionIdB} =
          createB.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .post(`/api/notebooks/${projectId}/records/${recordIdA}/revisions`)
            .send({revisionId: revisionIdB})
        ).expect(400);
      });
    });

    it('returns 400 when revisionId is missing from body', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId} = createRes.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records/${recordId}/revisions`).send({})
        ).expect(400);
      });
    });
  });

  describeMutations('delete record', () => {
    it('soft-deletes and returns 204', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .delete(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId})
        ).expect(204);
      });
    });

    it('returns 400 when revisionId query missing', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId} = createRes.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app).delete(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(400);
      });
    });

    it('returns 401 when user has no project-level delete permission', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .delete(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId}),
          localUserToken
        ).expect(401);
      });
    });

    it('returns 404 when deleting non-existent record', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .delete(
              `/api/notebooks/${projectId}/records/rec-00000000-0000-0000-0000-000000000000`
            )
            .query({
              revisionId: 'frev-00000000-0000-0000-0000-000000000000',
            })
        ).expect(404);
      });
    });
  });

  describeMutations('list filterDeleted', () => {
    it('excludes deleted records by default (filterDeleted true)', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;
        await requestAuthAndType(
          request(app)
            .delete(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId})
        ).expect(204);

        const listRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const list = (listRes.body as GetListRecordsResponse).records;
        const deletedInList = list.find(
          (r: ListRecordsItem) => r.recordId === recordId
        );
        expect(deletedInList).to.be.undefined;
      });
    });

    it('includes deleted records when filterDeleted is false', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app).post(`/api/notebooks/${projectId}/records`).send({
            formId: BACKUP_FORM_IDS.FORM2,
            createdBy: 'admin',
          })
        ).expect(201);
        const {recordId, revisionId} =
          createRes.body as PostCreateRecordResponse;
        await requestAuthAndType(
          request(app)
            .delete(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId})
        ).expect(204);

        const listRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2, filterDeleted: 'false'})
        ).expect(200);
        const list = (listRes.body as GetListRecordsResponse).records;
        const deletedInList = list.find(
          (r: ListRecordsItem) => r.recordId === recordId
        );
        expect(deletedInList).to.not.be.undefined;
        expect(deletedInList!.deleted).to.be.true;
      });
    });
  });

  describe('authorization', () => {
    it('list returns 401 without token', async () => {
      await withRecordsBackup(async projectId => {
        await request(app).get(`/api/notebooks/${projectId}/records/metadata`).expect(401);
      });
    });

    it('list returns 401 when user has no project-level read permission', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`),
          localUserToken
        ).expect(401);
      });
    });

    it('get one returns 401 without token', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .get(
            `/api/notebooks/${projectId}/records/${RECORD_ID_PREFIX}00000000-0000-0000-0000-000000000001`
          )
          .expect(401);
      });
    });
  });

  describe('record-level authorization (403)', () => {
    it('returns 403 when GUEST tries to get another user record', async () => {
      await withRecordsBackup(async projectId => {
        const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
        if (!couchUser) throw new Error('Local user not found');
        addProjectRole({
          user: couchUser,
          projectId: RECORDS_BACKUP_PROJECT_ID,
          role: Role.PROJECT_GUEST,
        });
        await saveCouchUser(couchUser);

        const expressUser =
          await getExpressUserFromEmailOrUserId(localUserName);
        if (!expressUser) throw new Error('Local user not found');
        const signingKey = await KEY_SERVICE.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const listAsAdmin = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);
        const records = (listAsAdmin.body as GetListRecordsResponse).records;
        const adminRecord = records.find(
          (r: ListRecordsItem) => r.createdBy === 'admin'
        );
        if (!adminRecord) throw new Error('No admin record in backup');

        await request(app)
          .get(`/api/notebooks/${projectId}/records/${adminRecord.recordId}`)
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Content-Type', 'application/json')
          .expect(403);
      });
    });

    describeMutations('mutating operations on another user record', () => {
      it('returns 403 when GUEST tries to update another user record', async () => {
      await withRecordsBackup(async projectId => {
        const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
        if (!couchUser) throw new Error('Local user not found');
        addProjectRole({
          user: couchUser,
          projectId: RECORDS_BACKUP_PROJECT_ID,
          role: Role.PROJECT_GUEST,
        });
        await saveCouchUser(couchUser);

        const expressUser =
          await getExpressUserFromEmailOrUserId(localUserName);
        if (!expressUser) throw new Error('Local user not found');
        const signingKey = await KEY_SERVICE.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const listAsAdmin = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);
        const records = (listAsAdmin.body as GetListRecordsResponse).records;
        const adminRecord = records.find(
          (r: ListRecordsItem) => r.createdBy === 'admin'
        );
        if (!adminRecord) throw new Error('No admin record in backup');

        await request(app)
          .put(`/api/notebooks/${projectId}/records/${adminRecord.recordId}`)
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Content-Type', 'application/json')
          .send({
            revisionId: adminRecord.revisionId,
            update: {hridFORM2: {data: 'x', attachments: []}},
          })
          .expect(403);
      });
      });

      it('returns 403 when GUEST tries to delete another user record', async () => {
        await withRecordsBackup(async projectId => {
          const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
          if (!couchUser) throw new Error('Local user not found');
          addProjectRole({
            user: couchUser,
            projectId: RECORDS_BACKUP_PROJECT_ID,
            role: Role.PROJECT_GUEST,
          });
          await saveCouchUser(couchUser);

          const expressUser =
            await getExpressUserFromEmailOrUserId(localUserName);
          if (!expressUser) throw new Error('Local user not found');
          const signingKey = await KEY_SERVICE.getSigningKey();
          const guestToken = await generateJwtFromUser({
            user: expressUser,
            signingKey,
          });

          const listAsAdmin = await requestAuthAndType(
            request(app).get(`/api/notebooks/${projectId}/records/metadata`)
          ).expect(200);
          const records = (listAsAdmin.body as GetListRecordsResponse).records;
          const adminRecord = records.find(
            (r: ListRecordsItem) => r.createdBy === 'admin'
          );
          if (!adminRecord) throw new Error('No admin record in backup');

          await request(app)
            .delete(`/api/notebooks/${projectId}/records/${adminRecord.recordId}`)
            .set('Authorization', `Bearer ${guestToken}`)
            .set('Content-Type', 'application/json')
            .query({revisionId: adminRecord.revisionId})
            .expect(403);
        });
      });

      it('returns 403 when GUEST tries to fork revision on another user record', async () => {
        await withRecordsBackup(async projectId => {
          const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
          if (!couchUser) throw new Error('Local user not found');
          addProjectRole({
            user: couchUser,
            projectId: RECORDS_BACKUP_PROJECT_ID,
            role: Role.PROJECT_GUEST,
          });
          await saveCouchUser(couchUser);

          const expressUser =
            await getExpressUserFromEmailOrUserId(localUserName);
          if (!expressUser) throw new Error('Local user not found');
          const signingKey = await KEY_SERVICE.getSigningKey();
          const guestToken = await generateJwtFromUser({
            user: expressUser,
            signingKey,
          });

          const listAsAdmin = await requestAuthAndType(
            request(app).get(`/api/notebooks/${projectId}/records/metadata`)
          ).expect(200);
          const records = (listAsAdmin.body as GetListRecordsResponse).records;
          const adminRecord = records.find(
            (r: ListRecordsItem) => r.createdBy === 'admin'
          );
          if (!adminRecord) throw new Error('No admin record in backup');

          await request(app)
            .post(`/api/notebooks/${projectId}/records/${adminRecord.recordId}/revisions`)
            .set('Authorization', `Bearer ${guestToken}`)
            .set('Content-Type', 'application/json')
            .send({revisionId: adminRecord.revisionId})
            .expect(403);
        });
      });
    });
  });

  (ENABLE_RECORDS_CRUD_MUTATIONS ? describe.skip : describe)(
    'record mutations disabled',
    () => {
      it('POST create returns 404', async () => {
        await withRecordsBackup(async projectId => {
          await requestAuthAndType(
            request(app)
              .post(`/api/notebooks/${projectId}/records`)
              .send({formId: BACKUP_FORM_IDS.FORM2})
          ).expect(404);
        });
      });
    }
  );
});
