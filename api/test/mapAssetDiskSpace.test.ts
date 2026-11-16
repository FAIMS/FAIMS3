// SPDX-License-Identifier: Apache-2.0
import {MAP_ASSET_UPLOAD_FREE_DISK_BYTES} from '@faims3/data-model';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ServiceUnavailableException} from '../src/exceptions';

const statfs = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {...actual, statfs};
});

import {assertMapUploadDiskAvailable} from '../src/couchdb/mapAssets/diskSpace';

describe('map asset disk pressure', () => {
  beforeEach(() => {
    statfs.mockReset();
  });

  it('allows an upload when free space is above the headroom', async () => {
    statfs.mockResolvedValue({
      bavail: MAP_ASSET_UPLOAD_FREE_DISK_BYTES / 4096 + 1,
      bsize: 4096,
    });
    await expect(assertMapUploadDiskAvailable()).resolves.toBeUndefined();
  });

  it('rejects with 503 when free space is below the headroom', async () => {
    statfs.mockResolvedValue({
      bavail: 1,
      bsize: 4096,
    });
    await expect(assertMapUploadDiskAvailable()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    try {
      await assertMapUploadDiskAvailable();
    } catch (error) {
      expect(error).toMatchObject({status: 503});
      expect((error as Error).message).toMatch(/server is busy/i);
    }
  });

  it('does not block the upload when free space cannot be read', async () => {
    statfs.mockRejectedValue(new Error('statfs unavailable'));
    await expect(assertMapUploadDiskAvailable()).resolves.toBeUndefined();
  });
});
