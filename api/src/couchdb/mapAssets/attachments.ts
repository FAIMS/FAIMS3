// SPDX-License-Identifier: Apache-2.0
/**
 * Stream map-layer attachments to and from CouchDB without buffering the
 * whole file. Production uses nano streams; tests keep PouchDB memory.
 */

import {createHash} from 'crypto';
import {createReadStream, createWriteStream} from 'fs';
import {readFile, stat, writeFile} from 'fs/promises';
import {getMapAssetsDB, getMapAssetsNano} from '..';
import * as Exceptions from '../../exceptions';
import {mapAssetUploadTooLargeMessage} from '@faims3/data-model';

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

function rethrowAttachmentError(error: unknown): never {
  const status =
    (error as {status?: number; statusCode?: number}).status ??
    (error as {statusCode?: number}).statusCode;
  if (status === 413) {
    throw new Exceptions.InvalidRequestException(
      mapAssetUploadTooLargeMessage()
    );
  }
  throw error;
}

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

export async function putFileAttachment({
  assetId,
  rev,
  attachmentId,
  filePath,
  contentType,
}: {
  assetId: string;
  rev: string;
  attachmentId: string;
  filePath: string;
  contentType: string;
}): Promise<string> {
  try {
    if (isTestEnv()) {
      const bytes = await readFile(filePath);
      const response = await getMapAssetsDB().putAttachment(
        assetId,
        attachmentId,
        rev,
        bytes,
        contentType
      );
      return response.rev;
    }
    const nano = await getMapAssetsNano();
    const size = (await stat(filePath)).size;
    const result = await nano.attachment.insert(
      assetId,
      attachmentId,
      createReadStream(filePath),
      contentType,
      {rev, content_length: size}
    );
    return result.rev;
  } catch (error) {
    rethrowAttachmentError(error);
  }
}

export async function downloadAttachmentToFile({
  assetId,
  attachmentId,
  destPath,
}: {
  assetId: string;
  attachmentId: string;
  destPath: string;
}): Promise<void> {
  if (isTestEnv()) {
    const data = await (
      getMapAssetsDB() as unknown as {
        getAttachment(docId: string, name: string): Promise<Buffer | Blob>;
      }
    ).getAttachment(assetId, attachmentId);
    const bytes = Buffer.isBuffer(data)
      ? data
      : Buffer.from(await data.arrayBuffer());
    await writeFile(destPath, new Uint8Array(bytes));
    return;
  }
  const nano = await getMapAssetsNano();
  await new Promise<void>((resolve, reject) => {
    const stream = nano.attachment.getAsStream(assetId, attachmentId);
    const out = createWriteStream(destPath);
    stream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    stream.pipe(out);
  });
}

export function assetHasAttachment(
  asset: object,
  attachmentId: string
): boolean {
  const attachments = (asset as {_attachments?: Record<string, unknown>})
    ._attachments;
  return Boolean(attachments?.[attachmentId]);
}
