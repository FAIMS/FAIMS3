// SPDX-License-Identifier: Apache-2.0
/**
 * Refuse a map-layer upload when this node does not have enough free disk
 * for the original plus a copy while it uploads to object storage.
 */

import {
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  MAP_ASSET_UPLOAD_FREE_DISK_BYTES,
} from '@faims3/data-model';
import {statfs} from 'fs/promises';
import {tmpdir} from 'os';
import {ServiceUnavailableException} from '../../exceptions';
import {logMapAssetProcessing} from '../../logging';

export {MAP_ASSET_UPLOAD_FREE_DISK_BYTES};

export async function freeDiskBytes(
  directory: string = tmpdir()
): Promise<number | undefined> {
  try {
    const info = await statfs(directory);
    return Number(info.bavail) * Number(info.bsize);
  } catch (error) {
    logMapAssetProcessing({
      event: 'disk.check',
      outcome: 'skipped',
      reason:
        error instanceof Error
          ? error.message
          : 'could not read free disk space',
    });
    return undefined;
  }
}

/** Throws 503 when free space is below the upload headroom. */
export async function assertMapUploadDiskAvailable(
  directory: string = tmpdir()
): Promise<void> {
  const free = await freeDiskBytes(directory);
  if (free === undefined) {
    return;
  }
  if (free < MAP_ASSET_UPLOAD_FREE_DISK_BYTES) {
    logMapAssetProcessing({
      event: 'disk.check',
      outcome: 'failure',
      byteSize: free,
      reason: MAP_ASSET_UPLOAD_BUSY_MESSAGE,
    });
    throw new ServiceUnavailableException(MAP_ASSET_UPLOAD_BUSY_MESSAGE);
  }
  logMapAssetProcessing({
    event: 'disk.check',
    outcome: 'success',
    byteSize: free,
  });
}
