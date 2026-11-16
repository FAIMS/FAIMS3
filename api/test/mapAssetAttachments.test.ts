// SPDX-License-Identifier: Apache-2.0
import {createHash} from 'crypto';
import {mkdtemp, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {Readable} from 'stream';
import {afterEach, describe, expect, it} from 'vitest';
import {
  assetHasStoredAttachment,
  collectStream,
  sha256,
  sha256File,
  storedAttachmentLocation,
} from '../src/couchdb/mapAssets/attachments';

const payload = Buffer.from('hello-map-asset');
const expectedHash = createHash('sha256')
  .update(new Uint8Array(payload))
  .digest('hex');

const stored = {
  provider: 's3' as const,
  resourceUri: 's3://us-east-1/bucket/map-assets/asset-1/original',
  contentType: 'application/geo+json',
  byteSize: payload.length,
};

describe('map asset attachment helpers', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(dir => rm(dir, {recursive: true, force: true}))
    );
  });

  it('hashes a buffer and a file to the same digest', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'map-asset-hash-'));
    dirs.push(dir);
    const filePath = path.join(dir, 'layer.geojson');
    await writeFile(filePath, new Uint8Array(payload));
    expect(sha256(payload)).toBe(expectedHash);
    await expect(sha256File(filePath)).resolves.toBe(expectedHash);
  });

  it('rejects a missing file instead of hashing empty bytes', async () => {
    await expect(sha256File('/tmp/does-not-exist-map-asset')).rejects.toThrow();
  });

  it('reports whether a document already recorded an attachment id', () => {
    expect(assetHasStoredAttachment({}, 'original')).toBe(false);
    expect(
      assetHasStoredAttachment(
        {storedAttachments: {original: stored}},
        'original'
      )
    ).toBe(true);
    expect(
      storedAttachmentLocation(
        {storedAttachments: {original: stored}},
        'original'
      )
    ).toEqual(stored);
    expect(storedAttachmentLocation({}, 'original')).toBeUndefined();
  });

  it('buffers a readable stream', async () => {
    const body = Readable.from([new Uint8Array(payload)]);
    await expect(collectStream(body)).resolves.toEqual(payload);
  });
});
