// SPDX-License-Identifier: Apache-2.0
/**
 * Stream map-layer files to and from object storage (S3 / RustFS / mock)
 * without buffering the whole file when a disk path is available.
 *
 * Couch documents store {@link StoredAttachmentLocation} metadata only.
 */

import {type StoredAttachmentLocation} from '@faims3/data-model';
import {createHash} from 'crypto';
import {createReadStream} from 'fs';
import {stat} from 'fs/promises';
import {Readable} from 'stream';
import {attachmentStorageService} from '../../buildconfig';
import {withMapAssetProcessingWait} from '../../logging';
import {collectAttachmentBody} from '../../services/attachmentStorageService';

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk: string | Buffer) =>
      hash.update(typeof chunk === 'string' ? chunk : new Uint8Array(chunk))
    );
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

export function mapAssetObjectKey(
  assetId: string,
  attachmentId: string
): string {
  return attachmentStorageService.objectKey(assetId, attachmentId);
}

export async function putFileAttachment({
  assetId,
  attachmentId,
  filePath,
  contentType,
}: {
  assetId: string;
  attachmentId: string;
  filePath: string;
  contentType: string;
}): Promise<StoredAttachmentLocation> {
  const size = await stat(filePath)
    .then(info => info.size)
    .catch(() => undefined);
  return withMapAssetProcessingWait(
    {
      event: 'attachment.put',
      assetId,
      attachmentId,
      byteSize: size,
    },
    async () => {
      const contentLength = size ?? (await stat(filePath)).size;
      return attachmentStorageService.upload({
        key: mapAssetObjectKey(assetId, attachmentId),
        body: createReadStream(filePath),
        contentType,
        contentLength,
      });
    }
  );
}

export async function putBytesAttachment({
  assetId,
  attachmentId,
  bytes,
  contentType,
}: {
  assetId: string;
  attachmentId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<StoredAttachmentLocation> {
  return withMapAssetProcessingWait(
    {
      event: 'attachment.put',
      assetId,
      attachmentId,
      byteSize: bytes.length,
    },
    () =>
      attachmentStorageService.upload({
        key: mapAssetObjectKey(assetId, attachmentId),
        body: bytes,
        contentType,
        contentLength: bytes.length,
      })
  );
}

export async function downloadAttachmentToFile({
  location,
  destPath,
  assetId,
  attachmentId,
}: {
  location: StoredAttachmentLocation;
  destPath: string;
  assetId?: string;
  attachmentId?: string;
}): Promise<void> {
  await withMapAssetProcessingWait(
    {
      event: 'attachment.download',
      assetId,
      attachmentId,
    },
    () =>
      attachmentStorageService.downloadToFile({
        location,
        destPath,
      })
  );
}

export function downloadAttachmentStream(location: StoredAttachmentLocation) {
  return attachmentStorageService.download({location});
}

export function presignAttachmentDownload({
  location,
  expiresInSeconds,
  contentType,
  filename,
}: {
  location: StoredAttachmentLocation;
  expiresInSeconds?: number;
  contentType?: string;
  filename?: string;
}): Promise<string> {
  return attachmentStorageService.getPresignedDownloadURL({
    location,
    expiresInSeconds,
    contentType,
    filename,
  });
}

export async function deleteStoredAttachment(
  location: StoredAttachmentLocation
): Promise<void> {
  await attachmentStorageService.delete({location});
}

export function assetHasStoredAttachment(
  asset: {storedAttachments?: Record<string, StoredAttachmentLocation>},
  attachmentId: string
): boolean {
  return Boolean(asset.storedAttachments?.[attachmentId]);
}

export function storedAttachmentLocation(
  asset: {storedAttachments?: Record<string, StoredAttachmentLocation>},
  attachmentId: string
): StoredAttachmentLocation | undefined {
  return asset.storedAttachments?.[attachmentId];
}

export async function collectStream(body: Readable): Promise<Buffer> {
  return collectAttachmentBody(body);
}
