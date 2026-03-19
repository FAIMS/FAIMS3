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
 * Uses test/fixtures/recordsApi for paths, types, and backup helpers.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {addProjectRole, registerClient, Role} from '@faims3/data-model';
import {expect} from 'chai';
import request from 'supertest';
import {KEY_SERVICE} from '../src/buildconfig';
import {
  getCouchUserFromEmailOrUserId,
  getExpressUserFromEmailOrUserId,
  saveCouchUser,
} from '../src/couchdb/users';
import {generateJwtFromUser} from '../src/auth/keySigning/create';
import {app} from '../src/expressSetup';
import {callbackObject} from './mocks';
import {
  BACKUP_FORM_IDS,
  CreateRecordBody,
  CreateRecordResponse,
  GetRecordResponse,
  ListRecordsResponse,
  MinimalRecordInList,
  recordPath,
  recordsBasePath,
  RECORD_ID_PREFIX,
  RECORDS_BACKUP_PROJECT_ID,
  REVISION_ID_PREFIX,
  UpdateRecordBody,
  UpdateRecordResponse,
  withRecordsBackup,
} from './fixtures/recordsApi';
import {
  adminToken,
  beforeApiTests,
  localUserToken,
  localUserName,
  requestAuthAndType,
} from './utils';

registerClient(callbackObject);

describe('Records CRUD API', () => {
  beforeEach(beforeApiTests);

  describe('list records', () => {
    it('returns permission-filtered list after restore', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app).get(recordsBasePath(projectId))
        ).expect(200);

        const body = res.body as ListRecordsResponse;
        expect(body).to.have.property('records');
        expect(body.records).to.be.an('array');
        expect(body.records.length).to.be.greaterThan(0);

        const first = body.records[0] as MinimalRecordInList;
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
            .get(recordsBasePath(projectId))
            .query({filterDeleted: 'true'})
        ).expect(200);
      });
    });

    it('filters by formId when provided', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const body = res.body as ListRecordsResponse;
        expect(body.records).to.be.an('array');
        body.records.forEach((r: MinimalRecordInList) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
        });
      });
    });

    it('applies limit when provided', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({limit: 3})
        ).expect(200);
        const body = res.body as ListRecordsResponse;
        expect(body.records.length).to.be.at.most(3);
      });
    });

    it('returns 400 when limit is greater than 500', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({limit: 501})
        ).expect(400);
      });
    });

    it('applies startKey for pagination (returns records after cursor)', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app).get(recordsBasePath(projectId)).query({limit: 5})
        ).expect(200);
        const fullBody = full.body as ListRecordsResponse;
        if (fullBody.records.length < 2) return;
        const cursor = fullBody.records[1].recordId;
        const res = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({limit: 10, startKey: cursor})
        ).expect(200);
        const body = res.body as ListRecordsResponse;
        expect(body.records.every((r: MinimalRecordInList) => r.recordId > cursor)).to.be.true;
      });
    });

    it('regression: list honors formId, limit, and startKey (params were previously ignored)', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({formId: BACKUP_FORM_IDS.FORM2, limit: 5})
        ).expect(200);
        const fullBody = full.body as ListRecordsResponse;
        expect(fullBody.records.length).to.be.at.most(5);
        fullBody.records.forEach((r: MinimalRecordInList) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
        });
        if (fullBody.records.length < 2) return;
        const cursor = fullBody.records[1].recordId;
        const page2 = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({
              formId: BACKUP_FORM_IDS.FORM2,
              limit: 2,
              startKey: cursor,
            })
        ).expect(200);
        const page2Body = page2.body as ListRecordsResponse;
        expect(page2Body.records.length).to.be.at.most(2);
        page2Body.records.forEach((r: MinimalRecordInList) => {
          expect(r.type).to.equal(BACKUP_FORM_IDS.FORM2);
          expect(r.recordId > cursor).to.be.true;
        });
      });
    });
  });

  describe('create record', () => {
    it('creates record and returns recordId and revisionId', async () => {
      await withRecordsBackup(async projectId => {
        const body: CreateRecordBody = {
          formId: BACKUP_FORM_IDS.FORM2,
          createdBy: 'admin',
        };

        const res = await requestAuthAndType(
          request(app).post(recordsBasePath(projectId)).send(body)
        ).expect(201);

        const created = res.body as CreateRecordResponse;
        expect(created.recordId).to.match(new RegExp(`^${RECORD_ID_PREFIX}`));
        expect(created.revisionId).to.match(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );

        const getRes = await requestAuthAndType(
          request(app).get(recordPath(projectId, created.recordId))
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
            .post(recordsBasePath(projectId))
            .send({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(201);

        const created = res.body as CreateRecordResponse;
        expect(created).to.have.property('recordId');

        const getRes = await requestAuthAndType(
          request(app).get(recordPath(projectId, created.recordId))
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).to.be.an('object');
      });
    });

    it('returns 401 without auth', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .post(recordsBasePath(projectId))
          .set('Content-Type', 'application/json')
          .send({formId: BACKUP_FORM_IDS.FORM2})
          .expect(401);
      });
    });

    it('returns 400 when formId is missing', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).post(recordsBasePath(projectId)).send({})
        ).expect(400);
      });
    });

    it('creates record with optional relationship', async () => {
      await withRecordsBackup(async projectId => {
        const parentRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({formId: BACKUP_FORM_IDS.FORM2, createdBy: 'admin'})
        ).expect(201);
        const parent = parentRes.body as CreateRecordResponse;

        const body: CreateRecordBody = {
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
          request(app).post(recordsBasePath(projectId)).send(body)
        ).expect(201);
        const created = res.body as CreateRecordResponse;
        expect(created.recordId).to.match(new RegExp(`^${RECORD_ID_PREFIX}`));
        const getRes = await requestAuthAndType(
          request(app).get(recordPath(projectId, created.recordId))
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).to.be.an('object');
      });
    });
  });

  describe('get one record', () => {
    it('returns full form data for existing record', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId} = createRes.body as CreateRecordResponse;

        const res = await requestAuthAndType(
          request(app).get(recordPath(projectId, recordId))
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
            recordPath(projectId, 'rec-nonexistent-0000000000000000')
          )
        ).expect(404);
      });
    });

    it('returns 401 without auth', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .get(recordsBasePath(projectId))
          .expect(401);
      });
    });

    it('returns specific revision when revisionId query provided', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId: rev1} =
          createRes.body as CreateRecordResponse;

        const updateRes = await requestAuthAndType(
          request(app)
            .patch(recordPath(projectId, recordId))
            .send({
              revisionId: rev1,
              update: {hridFORM2: {data: 'UpdatedValue', attachments: []}},
              mode: 'new',
            })
        ).expect(200);
        const revisionId2 = (updateRes.body as UpdateRecordResponse).revisionId;

        const getHead = await requestAuthAndType(
          request(app).get(recordPath(projectId, recordId))
        ).expect(200);
        const headBody = getHead.body as GetRecordResponse;
        expect(headBody.revisionId).to.equal(revisionId2);
        expect(headBody.data.hridFORM2?.data).to.equal('UpdatedValue');

        const getRev1 = await requestAuthAndType(
          request(app)
            .get(recordPath(projectId, recordId))
            .query({revisionId: rev1})
        ).expect(200);
        const bodyRev1 = getRev1.body as GetRecordResponse;
        expect(bodyRev1.revisionId).to.equal(rev1);
        expect(bodyRev1.formId).to.equal(BACKUP_FORM_IDS.FORM2);
        expect(bodyRev1.data).to.be.an('object');
      });
    });
  });

  describe('update record', () => {
    it('updates with partial field data (field-level)', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;

        const updateBody: UpdateRecordBody = {
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
          request(app)
            .patch(recordPath(projectId, recordId))
            .send(updateBody)
        ).expect(200);

        const updated = updateRes.body as UpdateRecordResponse;
        expect(updated).to.have.property('revisionId');
        expect(updated.revisionId).to.match(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );
        const getRes = await requestAuthAndType(
          request(app).get(recordPath(projectId, recordId))
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.data.hridFORM2?.data).to.equal('Element: Test-00001');
      });
    });

    it('returns 401 when user has no project-level edit permission', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;

        const updateBody: UpdateRecordBody = {
          revisionId,
          update: {hridFORM2: {data: 'x', attachments: []}},
        };

        await requestAuthAndType(
          request(app)
            .patch(recordPath(projectId, recordId))
            .send(updateBody),
          localUserToken
        ).expect(401);
      });
    });

    it('returns 400 when revisionId does not belong to record', async () => {
      await withRecordsBackup(async projectId => {
        const createA = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const createB = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId: recordIdA} = createA.body as CreateRecordResponse;
        const {revisionId: revisionIdB} = createB.body as CreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .patch(recordPath(projectId, recordIdA))
            .send({
              revisionId: revisionIdB,
              update: {hridFORM2: {data: 'x', attachments: []}},
            })
        ).expect(400);
      });
    });
  });

  describe('delete record', () => {
    it('soft-deletes and returns 204', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .delete(recordPath(projectId, recordId))
            .query({revisionId})
        ).expect(204);
      });
    });

    it('returns 400 when revisionId query missing', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId} = createRes.body as CreateRecordResponse;

        await requestAuthAndType(
          request(app).delete(recordPath(projectId, recordId))
        ).expect(400);
      });
    });

    it('returns 401 when user has no project-level delete permission', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;

        await requestAuthAndType(
          request(app)
            .delete(recordPath(projectId, recordId))
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
              recordPath(projectId, 'rec-00000000-0000-0000-0000-000000000000')
            )
            .query({
              revisionId: 'frev-00000000-0000-0000-0000-000000000000',
            })
        ).expect(404);
      });
    });
  });

  describe('list filterDeleted', () => {
    it('excludes deleted records by default (filterDeleted true)', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;
        await requestAuthAndType(
          request(app)
            .delete(recordPath(projectId, recordId))
            .query({revisionId})
        ).expect(204);

        const listRes = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const list = (listRes.body as ListRecordsResponse).records;
        const deletedInList = list.find(
          (r: MinimalRecordInList) => r.recordId === recordId
        );
        expect(deletedInList).to.be.undefined;
      });
    });

    it('includes deleted records when filterDeleted is false', async () => {
      await withRecordsBackup(async projectId => {
        const createRes = await requestAuthAndType(
          request(app)
            .post(recordsBasePath(projectId))
            .send({
              formId: BACKUP_FORM_IDS.FORM2,
              createdBy: 'admin',
            })
        ).expect(201);
        const {recordId, revisionId} = createRes.body as CreateRecordResponse;
        await requestAuthAndType(
          request(app)
            .delete(recordPath(projectId, recordId))
            .query({revisionId})
        ).expect(204);

        const listRes = await requestAuthAndType(
          request(app)
            .get(recordsBasePath(projectId))
            .query({formId: BACKUP_FORM_IDS.FORM2, filterDeleted: 'false'})
        ).expect(200);
        const list = (listRes.body as ListRecordsResponse).records;
        const deletedInList = list.find(
          (r: MinimalRecordInList) => r.recordId === recordId
        );
        expect(deletedInList).to.not.be.undefined;
        expect(deletedInList!.deleted).to.be.true;
      });
    });
  });

  describe('authorization', () => {
    it('list returns 401 without token', async () => {
      await withRecordsBackup(async projectId => {
        await request(app).get(recordsBasePath(projectId)).expect(401);
      });
    });

    it('list returns 401 when user has no project-level read permission', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app).get(recordsBasePath(projectId)),
          localUserToken
        ).expect(401);
      });
    });

    it('get one returns 401 without token', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .get(
            recordPath(
              projectId,
              `${RECORD_ID_PREFIX}00000000-0000-0000-0000-000000000001`
            )
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

        const expressUser = await getExpressUserFromEmailOrUserId(localUserName);
        if (!expressUser) throw new Error('Local user not found');
        const signingKey = await KEY_SERVICE.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const listAsAdmin = await requestAuthAndType(
          request(app).get(recordsBasePath(projectId))
        ).expect(200);
        const records = (listAsAdmin.body as ListRecordsResponse).records;
        const adminRecord = records.find(
          (r: MinimalRecordInList) => r.createdBy === 'admin'
        );
        if (!adminRecord) throw new Error('No admin record in backup');

        await request(app)
          .get(recordPath(projectId, adminRecord.recordId))
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Content-Type', 'application/json')
          .expect(403);
      });
    });

    it('returns 403 when GUEST tries to patch another user record', async () => {
      await withRecordsBackup(async projectId => {
        const couchUser = await getCouchUserFromEmailOrUserId(localUserName);
        if (!couchUser) throw new Error('Local user not found');
        addProjectRole({
          user: couchUser,
          projectId: RECORDS_BACKUP_PROJECT_ID,
          role: Role.PROJECT_GUEST,
        });
        await saveCouchUser(couchUser);

        const expressUser = await getExpressUserFromEmailOrUserId(localUserName);
        if (!expressUser) throw new Error('Local user not found');
        const signingKey = await KEY_SERVICE.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const listAsAdmin = await requestAuthAndType(
          request(app).get(recordsBasePath(projectId))
        ).expect(200);
        const records = (listAsAdmin.body as ListRecordsResponse).records;
        const adminRecord = records.find(
          (r: MinimalRecordInList) => r.createdBy === 'admin'
        );
        if (!adminRecord) throw new Error('No admin record in backup');

        await request(app)
          .patch(recordPath(projectId, adminRecord.recordId))
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

        const expressUser = await getExpressUserFromEmailOrUserId(localUserName);
        if (!expressUser) throw new Error('Local user not found');
        const signingKey = await KEY_SERVICE.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const listAsAdmin = await requestAuthAndType(
          request(app).get(recordsBasePath(projectId))
        ).expect(200);
        const records = (listAsAdmin.body as ListRecordsResponse).records;
        const adminRecord = records.find(
          (r: MinimalRecordInList) => r.createdBy === 'admin'
        );
        if (!adminRecord) throw new Error('No admin record in backup');

        await request(app)
          .delete(recordPath(projectId, adminRecord.recordId))
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Content-Type', 'application/json')
          .query({revisionId: adminRecord.revisionId})
          .expect(403);
      });
    });
  });
});
