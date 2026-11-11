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

/** SHA-256 hex digest of a file, streamed so large rasters stay off-heap. */
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

/** SHA-256 hex digest of an in-memory buffer. */
export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

/** Object-storage key for one attachment on a map-asset document. */
export function mapAssetObjectKey(
  assetId: string,
  attachmentId: string
): string {
  return attachmentStorageService.objectKey(assetId, attachmentId);
}

/**
 * Upload a file from disk into object storage and return the stored
 * location metadata for the Couch document.
 */
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

/** Upload an in-memory buffer (tests and tiny fixtures) to object storage. */
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

/** Stream an attachment from object storage onto disk. */
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

/** Readable stream of an attachment body from object storage. */
export function downloadAttachmentStream(location: StoredAttachmentLocation) {
  return attachmentStorageService.download({location});
}

/** Time-limited GET URL for a stored attachment. */
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

/** Remove one object from storage. Missing keys are ignored by the backend. */
export async function deleteStoredAttachment(
  location: StoredAttachmentLocation
): Promise<void> {
  await attachmentStorageService.delete({location});
}

/** True when the asset document already records this attachment id. */
export function assetHasStoredAttachment(
  asset: {storedAttachments?: Record<string, StoredAttachmentLocation>},
  attachmentId: string
): boolean {
  return Boolean(asset.storedAttachments?.[attachmentId]);
}

/** Stored location for `attachmentId`, or `undefined` if it was never uploaded. */
export function storedAttachmentLocation(
  asset: {storedAttachments?: Record<string, StoredAttachmentLocation>},
  attachmentId: string
): StoredAttachmentLocation | undefined {
  return asset.storedAttachments?.[attachmentId];
}

/** Buffer a Node readable; used when a caller must hold the whole body. */
export async function collectStream(body: Readable): Promise<Buffer> {
  return collectAttachmentBody(body);
}
