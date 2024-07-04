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
 * Filename: merging.test.ts
 * Description:
 *   TODO
 */

import {Record} from '../src/types';
import {
  generateFAIMSDataID,
  upsertFAIMSData,
  setRecordAsDeleted,
} from '../src/data_storage/index';
import {getRecord, getRevision} from '../src/data_storage/internals';
import {mergeHeads} from '../src/data_storage/merging';
import {registerClient} from '../src';
import {callbackObject, cleanDataDBS} from './mocks';

// register our mock database clients with the module
registerClient(callbackObject);

// disable debug output for tests
console.debug = () => {};

beforeEach(async () => {
  return await cleanDataDBS();
});

afterAll(async () => {
  return await cleanDataDBS();
});

describe('test basic automerge', () => {
  test('single revision', async () => {
    // This tests the case where there is a single revision (i.e. new record)

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    return upsertFAIMSData(project_id, doc)
      .then(_result => {
        return mergeHeads(project_id, record_id);
      })
      .then(status => {
        expect(status).toBe(true);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(1);
        expect(record.revisions).toHaveLength(1);
      });
  });

  test('no merged needed', async () => {
    // This tests the case where there is a linear history, so there's no need
    // for merging

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 2},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id2 = await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id2,
      type: fulltype,
      data: {avp1: 3},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id3,
      type: fulltype,
      data: {avp1: 4},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(true);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(1); // Should be one head
        expect(record.revisions).toHaveLength(4); // No merge should happen
      });
  });

  test('extra head', async () => {
    // This tests the case where there is a linear history, but where an old
    // head was not removed (this shouldn't happen, but maybe there's some bad
    // integration code that wrote to couchdb

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 2},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id2 = await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id2,
      type: fulltype,
      data: {avp1: 3},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id3,
      type: fulltype,
      data: {avp1: 4},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    const record = await getRecord(project_id, record_id);
    // add all revisions to heads
    record.heads = record.revisions.concat();
    const dataDB = await callbackObject.getDataDB(project_id);
    await dataDB.put(record);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(true);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(1); // Should be one head
        expect(record.revisions).toHaveLength(4); // No merge should happen
      });
  });

  test('same change', async () => {
    // This tests the case where there has been a split, but the same change has
    // been made. This should cause the basic automerge to fail.

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 2},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 3},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id3,
      type: fulltype,
      data: {avp1: 2},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be 2 head
        expect(record.revisions).toHaveLength(4); // no merge should happen
      });
  });

  test('different change', async () => {
    // This tests the case where there has been a split, and different changes
    // have been made. This should cause the basic automerge to fail.

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {avp1: 1},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 2},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {avp1: 3},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id3,
      type: fulltype,
      data: {avp1: 4},
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be two heads
        expect(record.revisions).toHaveLength(4); // No merge should happen
      });
  });

  test('changes to different avps', async () => {
    // This tests the case where there has been a split, but the changes have
    // been to different avps

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc3);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(true);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(1); // Should be 1 head
        expect(record.revisions).toHaveLength(4); // 1 merge should happen
      });
  });

  test('changes to different avps AND different change', async () => {
    // This tests the case where there are three heads, of which two can be
    // merged

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be 2 heads
        expect(record.revisions).toHaveLength(5); // 1 merge should happen
      });
  });

  test('changes to different avps AND different change 4 HEADS', async () => {
    // This tests the case where there are 4 heads, of which three can be merged
    // together

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
        avp3: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc4);

    const doc5: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 2,
        avp3: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc5);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be 2 heads
        expect(record.revisions).toHaveLength(7); // 2 merges should happen
      });
  });

  /*
   * Commented as we need to be able to do value comparison to do this test all
   * the time (this test depends on the order we work with the documents, which
   * is set by their uuids. As we're using random uuids, we can end up with 3
   * heads instead of 2, which is solvable only by the advanced automerger).
  test('changes to different avps AND different change 2 PAIRS', async () => {
    // This tests the case where there are 4 heads, but the merge this time is
    // as two pairs
    await cleanDataDBS();
    expect(projdbs === {});

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
        avp3: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
    };

    await upsertFAIMSData(project_id, doc3);

    const doc4: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
        avp3: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
    };

    await upsertFAIMSData(project_id, doc4);

    const doc5: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
        avp3: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
    };

    await upsertFAIMSData(project_id, doc5);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be 2 heads
        expect(record.revisions).toHaveLength(7); // 2 merges should happen
      });
  });
  */

  test('merge deleted and non-deleted', async () => {
    // This tests the case where there are 2 heads, and one revision is marked
    // deleted

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {},
      field_types: {field_name: fulltype},
    };

    await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    await setRecordAsDeleted(project_id, record_id, revision_id3, user_id);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(false);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(2); // Should be 1 head
        expect(record.revisions).toHaveLength(4); // 1 merge should happen
      });
  });

  test('merge deleted and deleted', async () => {
    // This tests the case where there are 2 heads, and both revisions are
    // marked deleted

    const project_id = 'test';
    const fulltype = 'test::test';
    const time = new Date();
    const user_id = 'user';

    const record_id = generateFAIMSDataID();

    const doc1: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: null,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id1 = await upsertFAIMSData(project_id, doc1);

    const doc2: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 2,
        avp2: 1,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id2 = await upsertFAIMSData(project_id, doc2);

    const doc3: Record = {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id1,
      type: fulltype,
      data: {
        avp1: 1,
        avp2: 2,
      },
      created_by: user_id,
      updated_by: user_id,
      created: time,
      updated: time,
      annotations: {
        avp1: 1,
        avp2: 1,
      },
      field_types: {field_name: fulltype},
    };

    const revision_id3 = await upsertFAIMSData(project_id, doc3);

    await setRecordAsDeleted(project_id, record_id, revision_id2, user_id);
    await setRecordAsDeleted(project_id, record_id, revision_id3, user_id);

    return mergeHeads(project_id, record_id)
      .then(status => {
        expect(status).toBe(true);
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        return getRevision(project_id, record.heads[0]);
      })
      .then(revision => {
        expect(revision.deleted).toBe(true); // Should be deleted
      })
      .then(() => {
        return getRecord(project_id, record_id);
      })
      .then(record => {
        expect(record.heads).toHaveLength(1); // Should be 1 head
        expect(record.revisions).toHaveLength(6); // 1 merge should happen
      });
  });
});
