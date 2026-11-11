// SPDX-License-Identifier: Apache-2.0
import {buildContextualLayersHash} from '../src/data_storage/mapAssetsDB/hash';

describe('buildContextualLayersHash', () => {
  it('is stable regardless of input order', async () => {
    const a = await buildContextualLayersHash([
      {id: 'b', contentHash: '2'},
      {id: 'a', contentHash: '1'},
    ]);
    const b = await buildContextualLayersHash([
      {id: 'a', contentHash: '1'},
      {id: 'b', contentHash: '2'},
    ]);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('changes when a content hash changes', async () => {
    const before = await buildContextualLayersHash([
      {id: 'a', contentHash: '1'},
    ]);
    const after = await buildContextualLayersHash([
      {id: 'a', contentHash: '2'},
    ]);
    expect(after).not.toBe(before);
  });

  it('hashes an empty link set to a stable digest', async () => {
    const first = await buildContextualLayersHash([]);
    const second = await buildContextualLayersHash([]);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
