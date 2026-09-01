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
  DatabaseInterface,
  DataDocument,
  DataEngine,
  GetListHydratedRecordsResponse,
  GetListRecordsResponse,
  GetRecordResponse,
  ListHydratedRecordsItem,
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
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {generateJwtFromUser} from '../src/auth/keySigning/create';
import {config, keyService} from '../src/buildconfig';
import {getDataDb} from '../src/couchdb';
import {getCompiledUiSpecModel} from '../src/couchdb/notebooks';
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

async function softDeleteRecord({
  projectId,
  recordId,
  revisionId,
}: {
  projectId: string;
  recordId: string;
  revisionId: string;
}): Promise<void> {
  const dataDb = await getDataDb(projectId);
  const uiSpec = await getCompiledUiSpecModel(projectId);
  const engine = new DataEngine({
    dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
    uiSpec,
  });
  await engine.deleteRecord({
    recordId,
    baseRevisionId: revisionId,
    userId: 'admin',
  });
}

describe('Records CRUD API', () => {
  beforeEach(beforeApiTests);

  describe('list records', () => {
    it('returns permission-filtered list after restore', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);

        const body = res.body as GetListRecordsResponse;
        expect(body).toHaveProperty('records');
        expect(body.records).toBeInstanceOf(Array);
        expect(body.records.length).toBeGreaterThan(0);

        const first = body.records[0] as ListRecordsItem;
        expect(first).toHaveProperty('recordId');
        expect(first).toHaveProperty('revisionId');
        expect(first).toHaveProperty('createdBy');
        expect(first).toHaveProperty('type');
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
        expect(body.records).toBeInstanceOf(Array);
        body.records.forEach((r: ListRecordsItem) => {
          expect(r.type).toBe(BACKUP_FORM_IDS.FORM2);
        });
      });
    });

    it('applies limit when provided', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({limit: 3})
        ).expect(200);
        const body = res.body as GetListRecordsResponse;
        expect(body.records.length).toBeLessThanOrEqual(3);
      });
    });

    it('returns 400 when limit is greater than 500', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({limit: 501})
        ).expect(400);
      });
    });

    it('applies startKey for pagination (returns records after cursor)', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({limit: 5})
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
        expect(
          body.records.every((r: ListRecordsItem) => r.recordId > cursor)
        ).toBe(true);
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
        expect(fullBody.records.length).toBeLessThanOrEqual(5);
        fullBody.records.forEach((r: ListRecordsItem) => {
          expect(r.type).toBe(BACKUP_FORM_IDS.FORM2);
        });
        if (fullBody.records.length < 2) return;
        const cursor = fullBody.records[1].recordId;
        const page2 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({
              formId: BACKUP_FORM_IDS.FORM2,
              limit: 2,
              startKey: cursor,
            })
        ).expect(200);
        const page2Body = page2.body as GetListRecordsResponse;
        expect(page2Body.records.length).toBeLessThanOrEqual(2);
        page2Body.records.forEach((r: ListRecordsItem) => {
          expect(r.type).toBe(BACKUP_FORM_IDS.FORM2);
          expect(r.recordId > cursor).toBe(true);
        });
      });
    });

    it('filters exclusively by updatedAfter and updatedBefore', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);
        const all = (full.body as GetListRecordsResponse).records;
        expect(all.length).toBeGreaterThan(1);
        const target = all[0];
        const targetMs = Date.parse(target.updated);
        expect(Number.isNaN(targetMs)).toBe(false);

        const afterRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: String(targetMs)})
        ).expect(200);
        const afterIds = (afterRes.body as GetListRecordsResponse).records.map(
          r => r.recordId
        );
        expect(afterIds).not.toContain(target.recordId);
        afterIds.forEach(id => {
          const rec = all.find(r => r.recordId === id);
          expect(rec).toBeDefined();
          expect(Date.parse(rec!.updated)).toBeGreaterThan(targetMs);
        });

        const beforeRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedBefore: String(targetMs)})
        ).expect(200);
        const beforeIds = (
          beforeRes.body as GetListRecordsResponse
        ).records.map(r => r.recordId);
        expect(beforeIds).not.toContain(target.recordId);
        beforeIds.forEach(id => {
          const rec = all.find(r => r.recordId === id);
          expect(rec).toBeDefined();
          expect(Date.parse(rec!.updated)).toBeLessThan(targetMs);
        });

        const tight = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({
              updatedAfter: String(targetMs - 1),
              updatedBefore: String(targetMs + 1),
            })
        ).expect(200);
        const tightIds = (tight.body as GetListRecordsResponse).records.map(
          r => r.recordId
        );
        expect(tightIds).toContain(target.recordId);
      });
    });

    it('paginates time-filtered results with nextStartKey', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: '0'})
        ).expect(200);
        const all = (full.body as GetListRecordsResponse).records;
        expect(all.length).toBeGreaterThan(1);

        const page1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: '0', limit: 1})
        ).expect(200);
        const page1Body = page1.body as GetListRecordsResponse;
        expect(page1Body.records).toHaveLength(1);
        expect(page1Body.nextStartKey).toBeDefined();

        const page2 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({
              updatedAfter: '0',
              limit: 1,
              startKey: page1Body.nextStartKey,
            })
        ).expect(200);
        const page2Body = page2.body as GetListRecordsResponse;
        expect(page2Body.records).toHaveLength(1);
        expect(page2Body.records[0].recordId).not.toBe(
          page1Body.records[0].recordId
        );
      });
    });

    it('returns 400 when updatedAfter is greater than or equal to updatedBefore', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: '100', updatedBefore: '50'})
        ).expect(400);
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: '50', updatedBefore: '50'})
        ).expect(400);
      });
    });

    it('returns 400 when updatedAfter or updatedBefore is not numeric', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedAfter: 'not-a-number'})
        ).expect(400);
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({updatedBefore: '1.5'})
        ).expect(400);
      });
    });
  });

  describe('list hydrated records', () => {
    it('returns permission-filtered hydrated items only', async () => {
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
        const signingKey = await keyService.getSigningKey();
        const guestToken = await generateJwtFromUser({
          user: expressUser,
          signingKey,
        });

        const adminRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/hydrated`)
        ).expect(200);
        const adminBody = adminRes.body as GetListHydratedRecordsResponse;
        expect(adminBody.records.length).toBeGreaterThan(0);
        const adminOwned = adminBody.records.filter(
          (r: ListHydratedRecordsItem) => r.createdBy === 'admin'
        );
        expect(adminOwned.length).toBeGreaterThan(0);

        const guestRes = await request(app)
          .get(`/api/notebooks/${projectId}/records/hydrated`)
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Content-Type', 'application/json')
          .expect(200);
        const guestBody = guestRes.body as GetListHydratedRecordsResponse;
        expect(
          guestBody.records.every(
            (r: ListHydratedRecordsItem) => r.createdBy === localUserName
          )
        ).toBe(true);
        expect(
          guestBody.records.some(
            (r: ListHydratedRecordsItem) => r.createdBy === 'admin'
          )
        ).toBe(false);
      });
    });

    it('includes stub fields and wrapped data matching GET one record', async () => {
      await withRecordsBackup(async projectId => {
        const listRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/hydrated`)
        ).expect(200);
        const body = listRes.body as GetListHydratedRecordsResponse;
        expect(body.records.length).toBeGreaterThan(0);

        const item = body.records[0];
        expect(item).toHaveProperty('recordId');
        expect(item).toHaveProperty('revisionId');
        expect(item).toHaveProperty('createdBy');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('deleted');
        expect(item).toHaveProperty('formId');
        expect(item.formId).toBe(item.type);
        expect(item.data).toBeTypeOf('object');
        expect(item.context).toHaveProperty('hrid');

        const fieldId = Object.keys(item.data)[0];
        if (fieldId) {
          expect(item.data[fieldId]).toBeTypeOf('object');
          expect(item.data[fieldId]).toHaveProperty('data');
        }

        const oneRes = await requestAuthAndType(
          request(app).get(
            `/api/notebooks/${projectId}/records/${item.recordId}`
          )
        ).expect(200);
        const one = oneRes.body as GetRecordResponse;
        expect(item.revisionId).toBe(one.revisionId);
        expect(item.formId).toBe(one.formId);
        if (fieldId) {
          expect(item.data[fieldId]?.data).toEqual(one.data[fieldId]?.data);
        }
      });
    });

    it('defaults to the env page size and paginates with nextStartKey', async () => {
      await withRecordsBackup(async projectId => {
        const original = config.recordsHydratedPageLimit;
        config.recordsHydratedPageLimit = 2;
        try {
          const defaultPage = await requestAuthAndType(
            request(app).get(`/api/notebooks/${projectId}/records/hydrated`)
          ).expect(200);
          const defaultBody =
            defaultPage.body as GetListHydratedRecordsResponse;
          expect(defaultBody.records.length).toBeLessThanOrEqual(2);
          expect(defaultBody.nextStartKey).toBeDefined();

          const page1 = await requestAuthAndType(
            request(app)
              .get(`/api/notebooks/${projectId}/records/hydrated`)
              .query({limit: 1})
          ).expect(200);
          const page1Body = page1.body as GetListHydratedRecordsResponse;
          expect(page1Body.records).toHaveLength(1);
          expect(page1Body.nextStartKey).toBeDefined();

          const page2 = await requestAuthAndType(
            request(app)
              .get(`/api/notebooks/${projectId}/records/hydrated`)
              .query({limit: 1, startKey: page1Body.nextStartKey})
          ).expect(200);
          const page2Body = page2.body as GetListHydratedRecordsResponse;
          expect(page2Body.records).toHaveLength(1);
          expect(page2Body.records[0].recordId).not.toBe(
            page1Body.records[0].recordId
          );
        } finally {
          config.recordsHydratedPageLimit = original;
        }
      });
    });

    it('paginates hydrated rows when no time params are set', async () => {
      await withRecordsBackup(async projectId => {
        const page1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({limit: 1})
        ).expect(200);
        const page1Body = page1.body as GetListHydratedRecordsResponse;
        expect(page1Body.records).toHaveLength(1);
        expect(page1Body.records[0].data).toBeTypeOf('object');
        expect(page1Body.nextStartKey).toBeDefined();
        expect(() => JSON.parse(page1Body.nextStartKey as string)).toThrow();

        const page2 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({limit: 1, startKey: page1Body.nextStartKey})
        ).expect(200);
        const page2Body = page2.body as GetListHydratedRecordsResponse;
        expect(page2Body.records[0].recordId).not.toBe(
          page1Body.records[0].recordId
        );
      });
    });

    it('filters exclusively by updatedAfter and updatedBefore', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/metadata`)
        ).expect(200);
        const all = (full.body as GetListRecordsResponse).records;
        expect(all.length).toBeGreaterThan(1);
        const target = all[0];
        const targetMs = Date.parse(target.updated);
        expect(Number.isNaN(targetMs)).toBe(false);

        const afterRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: String(targetMs)})
        ).expect(200);
        const afterIds = (
          afterRes.body as GetListHydratedRecordsResponse
        ).records.map(r => r.recordId);
        expect(afterIds).not.toContain(target.recordId);
        afterIds.forEach(id => {
          const rec = all.find(r => r.recordId === id);
          expect(rec).toBeDefined();
          expect(Date.parse(rec!.updated)).toBeGreaterThan(targetMs);
        });

        const beforeRes = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedBefore: String(targetMs)})
        ).expect(200);
        const beforeIds = (
          beforeRes.body as GetListHydratedRecordsResponse
        ).records.map(r => r.recordId);
        expect(beforeIds).not.toContain(target.recordId);
        beforeIds.forEach(id => {
          const rec = all.find(r => r.recordId === id);
          expect(rec).toBeDefined();
          expect(Date.parse(rec!.updated)).toBeLessThan(targetMs);
        });

        const tight = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({
              updatedAfter: String(targetMs - 1),
              updatedBefore: String(targetMs + 1),
            })
        ).expect(200);
        const tightIds = (
          tight.body as GetListHydratedRecordsResponse
        ).records.map(r => r.recordId);
        expect(tightIds).toContain(target.recordId);
      });
    });

    it('paginates time-filtered results with nextStartKey', async () => {
      await withRecordsBackup(async projectId => {
        const full = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: '0'})
        ).expect(200);
        const all = (full.body as GetListHydratedRecordsResponse).records;
        expect(all.length).toBeGreaterThan(1);

        const page1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: '0', limit: 1})
        ).expect(200);
        const page1Body = page1.body as GetListHydratedRecordsResponse;
        expect(page1Body.records).toHaveLength(1);
        expect(page1Body.nextStartKey).toBeDefined();

        const page2 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({
              updatedAfter: '0',
              limit: 1,
              startKey: page1Body.nextStartKey,
            })
        ).expect(200);
        const page2Body = page2.body as GetListHydratedRecordsResponse;
        expect(page2Body.records).toHaveLength(1);
        expect(page2Body.records[0].recordId).not.toBe(
          page1Body.records[0].recordId
        );
      });
    });

    it('encodes time-filtered nextStartKey as [updatedMs, recordId]', async () => {
      await withRecordsBackup(async projectId => {
        const page1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: '0', limit: 1})
        ).expect(200);
        const cursor = (page1.body as GetListHydratedRecordsResponse)
          .nextStartKey;
        expect(cursor).toBeDefined();
        const parsed = JSON.parse(cursor as string);
        expect(parsed).toHaveLength(2);
        expect(typeof parsed[0]).toBe('number');
        expect(typeof parsed[1]).toBe('string');
      });
    });

    it('returns 400 when updatedAfter is greater than or equal to updatedBefore', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: '100', updatedBefore: '50'})
        ).expect(400);
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: '50', updatedBefore: '50'})
        ).expect(400);
      });
    });

    it('returns 400 when updatedAfter or updatedBefore is not numeric', async () => {
      await withRecordsBackup(async projectId => {
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedAfter: 'not-a-number'})
        ).expect(400);
        await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({updatedBefore: '1.5'})
        ).expect(400);
      });
    });

    it('includes soft-deletes only when filterDeleted is false', async () => {
      await withRecordsBackup(async projectId => {
        const listed = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const sample = (listed.body as GetListRecordsResponse).records[0];
        expect(sample).toBeDefined();

        await softDeleteRecord({
          projectId,
          recordId: sample.recordId,
          revisionId: sample.revisionId,
        });

        const hidden = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        expect(
          (hidden.body as GetListHydratedRecordsResponse).records.find(
            r => r.recordId === sample.recordId
          )
        ).toBeUndefined();

        const shown = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/hydrated`)
            .query({formId: BACKUP_FORM_IDS.FORM2, filterDeleted: 'false'})
        ).expect(200);
        const deleted = (
          shown.body as GetListHydratedRecordsResponse
        ).records.find(r => r.recordId === sample.recordId);
        expect(deleted).toBeDefined();
        expect(deleted!.deleted).toBe(true);
      });
    });

    it('returns 400 when limit is above the env max', async () => {
      await withRecordsBackup(async projectId => {
        const original = config.recordsHydratedPageLimit;
        config.recordsHydratedPageLimit = 2;
        try {
          await requestAuthAndType(
            request(app)
              .get(`/api/notebooks/${projectId}/records/hydrated`)
              .query({limit: 3})
          ).expect(400);
        } finally {
          config.recordsHydratedPageLimit = original;
        }
      });
    });

    it('does not treat hydrated as a record id', async () => {
      await withRecordsBackup(async projectId => {
        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/hydrated`)
        ).expect(200);
        const body = res.body as GetListHydratedRecordsResponse;
        expect(body).toHaveProperty('records');
        expect(body.records).toBeInstanceOf(Array);
      });
    });
  });

  describe('export time range', () => {
    it('puts exclusive bounds on the download JWT and streams a tight CSV window', async () => {
      await withRecordsBackup(async projectId => {
        const listed = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/metadata`)
            .query({formId: BACKUP_FORM_IDS.FORM2})
        ).expect(200);
        const formRecords = (listed.body as GetListRecordsResponse).records;
        expect(formRecords.length).toBeGreaterThan(1);

        const byUpdated = [...formRecords].sort(
          (a, b) => Date.parse(a.updated) - Date.parse(b.updated)
        );
        const target = byUpdated[0];
        const outsider = byUpdated.find(
          r => Date.parse(r.updated) !== Date.parse(target.updated)
        );
        expect(outsider).toBeDefined();

        const targetMs = Date.parse(target.updated);
        const updatedAfter = String(targetMs - 1);
        const updatedBefore = String(targetMs + 1);

        const issued = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/export`).query({
            format: 'csv',
            viewID: BACKUP_FORM_IDS.FORM2,
            updatedAfter,
            updatedBefore,
          })
        ).expect(200);

        const downloadUrl = (issued.body as {url: string}).url;
        const token = downloadUrl.split('/').pop()!;
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString()
        ) as {
          updatedAfter?: number;
          updatedBefore?: number;
          format: string;
          viewID?: string;
        };
        expect(payload.updatedAfter).toBe(targetMs - 1);
        expect(payload.updatedBefore).toBe(targetMs + 1);
        expect(payload.format).toBe('csv');
        expect(payload.viewID).toBe(BACKUP_FORM_IDS.FORM2);

        const urlPath = downloadUrl.startsWith('http')
          ? new URL(downloadUrl).pathname
          : downloadUrl;
        const csv = await request(app).get(urlPath).expect(200);
        expect(csv.text).toContain(target.recordId);
        expect(csv.text).not.toContain(outsider!.recordId);
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
        expect(created.recordId).toMatch(new RegExp(`^${RECORD_ID_PREFIX}`));
        expect(created.revisionId).toMatch(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );

        const getRes = await requestAuthAndType(
          request(app).get(
            `/api/notebooks/${projectId}/records/${created.recordId}`
          )
        ).expect(200);

        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.formId).toBe(BACKUP_FORM_IDS.FORM2);
        expect(getBody.revisionId).toBe(created.revisionId);
        expect(getBody).toHaveProperty('data');
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
        expect(created).toHaveProperty('recordId');

        const getRes = await requestAuthAndType(
          request(app).get(
            `/api/notebooks/${projectId}/records/${created.recordId}`
          )
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).toBeTypeOf('object');
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
        expect(created.recordId).toMatch(new RegExp(`^${RECORD_ID_PREFIX}`));
        const getRes = await requestAuthAndType(
          request(app).get(
            `/api/notebooks/${projectId}/records/${created.recordId}`
          )
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.context.record).toBeTypeOf('object');
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
        const sample = records.find(
          (r: ListRecordsItem) => r.createdBy === 'admin'
        );
        if (!sample)
          throw new Error('expected an admin-owned record in backup');
        const {recordId} = sample;

        const res = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);

        const body = res.body as GetRecordResponse;
        expect(body).toHaveProperty('formId');
        expect(body).toHaveProperty('revisionId');
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('context');
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
        await request(app)
          .get(`/api/notebooks/${projectId}/records/metadata`)
          .expect(401);
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
        expect(headBody.revisionId).toBe(revisionId2);
        expect(headBody.data.hridFORM2?.data).toBe('UpdatedValue');

        const getRev1 = await requestAuthAndType(
          request(app)
            .get(`/api/notebooks/${projectId}/records/${recordId}`)
            .query({revisionId: rev1})
        ).expect(200);
        const bodyRev1 = getRev1.body as GetRecordResponse;
        expect(bodyRev1.revisionId).toBe(rev1);
        expect(bodyRev1.formId).toBe(BACKUP_FORM_IDS.FORM2);
        expect(bodyRev1.data).toBeTypeOf('object');
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
          request(app)
            .put(`/api/notebooks/${projectId}/records/${recordId}`)
            .send(updateBody)
        ).expect(200);

        const updated = updateRes.body as PatchUpdateRecordResponse;
        expect(updated).toHaveProperty('revisionId');
        expect(updated.revisionId).toMatch(
          new RegExp(`^${REVISION_ID_PREFIX}`)
        );
        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.data.hridFORM2?.data).toBe('Element: Test-00001');
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
          request(app)
            .put(`/api/notebooks/${projectId}/records/${recordId}`)
            .send(updateBody),
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
        expect(forked.revisionId).toMatch(new RegExp(`^${REVISION_ID_PREFIX}`));
        expect(forked.revisionId).not.toBe(baseRev);

        const getRes = await requestAuthAndType(
          request(app).get(`/api/notebooks/${projectId}/records/${recordId}`)
        ).expect(200);
        const getBody = getRes.body as GetRecordResponse;
        expect(getBody.revisionId).toBe(forked.revisionId);
        expect(getBody.context.revision.parents).toEqual([baseRev]);
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
        expect((getRes.body as GetRecordResponse).data.hridFORM2?.data).toBe(
          'ForkedParentEdit'
        );
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
          request(app)
            .post(`/api/notebooks/${projectId}/records/${recordId}/revisions`)
            .send({})
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
        expect(deletedInList).toBeUndefined();
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
        expect(deletedInList).not.toBeUndefined();
        expect(deletedInList!.deleted).toBe(true);
      });
    });
  });

  describe('authorization', () => {
    it('list returns 401 without token', async () => {
      await withRecordsBackup(async projectId => {
        await request(app)
          .get(`/api/notebooks/${projectId}/records/metadata`)
          .expect(401);
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
        const signingKey = await keyService.getSigningKey();
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
          const signingKey = await keyService.getSigningKey();
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
          const signingKey = await keyService.getSigningKey();
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
            .delete(
              `/api/notebooks/${projectId}/records/${adminRecord.recordId}`
            )
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
          const signingKey = await keyService.getSigningKey();
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
            .post(
              `/api/notebooks/${projectId}/records/${adminRecord.recordId}/revisions`
            )
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
