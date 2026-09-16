/*
 * Copyright 2026 Macquarie University
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
 * Filename: getAttributeValuePairs.test.ts
 * Description:
 *   Regression tests for AVP retrieval under includeAttachments: false (the
 *   export streaming mode). An AVP whose faims_attachments list is empty -
 *   which server-written AVPs carry - must keep its data untouched; only
 *   AVPs with actual attachment references have their data replaced by the
 *   unresolved reference list. Previously the guard only checked the list
 *   for null/undefined, so a present-but-empty list caused every field's
 *   data to be overwritten with [] and CSV exports rendered empty values.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {DatabaseInterface, DataDocument} from '../src';
import {getAttributeValuePairs} from '../src/data_storage/internals';
import {couchInitialiser, initDataDB} from '../src/data_storage';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('getAttributeValuePairs with includeAttachments: false', () => {
  let db: DatabaseInterface<DataDocument>;

  beforeEach(async () => {
    db = new PouchDB('test-avp-db', {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    await couchInitialiser({
      db,
      content: initDataDB({projectId: 'test-avp'}),
      config: {forceWrite: true, applyPermissions: false},
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  const baseAvp = (id: string) => ({
    _id: id,
    avp_format_version: 1,
    record_id: 'rec-test',
    revision_id: 'frev-test',
    created: new Date().toISOString(),
    created_by: 'tester',
  });

  test('keeps data for an AVP with an empty attachments list', async () => {
    await db.put({
      ...baseAvp('avp-plain'),
      type: 'faims-core::String',
      data: 'dig notes here',
      faims_attachments: [],
    } as any);

    const result = await getAttributeValuePairs({
      dataDb: db as any,
      avpIds: ['avp-plain'],
      includeAttachments: false,
    });

    expect(result['avp-plain'].data).toBe('dig notes here');
  });

  test('keeps data for an AVP with no attachments key at all', async () => {
    await db.put({
      ...baseAvp('avp-legacy'),
      type: 'faims-core::Number',
      data: 42,
    } as any);

    const result = await getAttributeValuePairs({
      dataDb: db as any,
      avpIds: ['avp-legacy'],
      includeAttachments: false,
    });

    expect(result['avp-legacy'].data).toBe(42);
  });

  test('substitutes unresolved references for an AVP with real attachments', async () => {
    const refs = [
      {attachment_id: 'att-1', filename: 'photo.jpg', file_type: 'image/jpeg'},
    ];
    await db.put({
      ...baseAvp('avp-photo'),
      type: 'faims-attachment::Files',
      data: null,
      faims_attachments: refs,
    } as any);

    const result = await getAttributeValuePairs({
      dataDb: db as any,
      avpIds: ['avp-photo'],
      includeAttachments: false,
    });

    // Streaming mode: data carries the unresolved reference list.
    expect(result['avp-photo'].data).toEqual(refs);
  });

  test('mixed batch: plain data survives while attachment AVPs are substituted', async () => {
    await db.put({
      ...baseAvp('avp-a'),
      type: 'faims-core::String',
      data: 'A9-L1',
      faims_attachments: [],
    } as any);
    const refs = [
      {attachment_id: 'att-2', filename: 'scan.png', file_type: 'image/png'},
    ];
    await db.put({
      ...baseAvp('avp-b'),
      type: 'faims-attachment::Files',
      data: null,
      faims_attachments: refs,
    } as any);

    const result = await getAttributeValuePairs({
      dataDb: db as any,
      avpIds: ['avp-a', 'avp-b'],
      includeAttachments: false,
    });

    expect(result['avp-a'].data).toBe('A9-L1');
    expect(result['avp-b'].data).toEqual(refs);
  });
});
