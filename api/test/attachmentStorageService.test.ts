// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it} from 'vitest';
import {
  AttachmentStorageType,
  collectAttachmentBody,
  createAttachmentStorageService,
  formatS3ResourceUri,
  joinObjectKey,
  MockAttachmentStorageService,
  parseS3ResourceUri,
} from '../src/services/attachmentStorageService';

const config = {
  bucket: 'test-map-assets',
  prefix: 'map-assets',
  region: 'us-east-1',
};

describe('S3 resource URI', () => {
  it('formats and parses s3://region/bucket/key including slashes in the key', () => {
    const resourceUri = formatS3ResourceUri({
      region: 'ap-southeast-2',
      bucket: 'faims-map-assets',
      key: 'map-assets/asset-1/original',
    });
    expect(resourceUri).toBe(
      's3://ap-southeast-2/faims-map-assets/map-assets/asset-1/original'
    );
    expect(parseS3ResourceUri(resourceUri)).toEqual({
      region: 'ap-southeast-2',
      bucket: 'faims-map-assets',
      key: 'map-assets/asset-1/original',
    });
  });

  it('rejects a URI that is not s3://region/bucket/key', () => {
    expect(() => parseS3ResourceUri('https://example.com/file')).toThrow(
      /must start with s3:\/\//
    );
    expect(() => parseS3ResourceUri('s3://region-only')).toThrow(/Invalid S3/);
  });
});

describe('joinObjectKey', () => {
  it('joins prefix and parts without extra slashes', () => {
    expect(joinObjectKey('/map-assets/', 'asset-1', 'original')).toBe(
      'map-assets/asset-1/original'
    );
  });

  it('strips parent-directory segments', () => {
    expect(joinObjectKey('map-assets', '../secret', 'original')).toBe(
      'map-assets/secret/original'
    );
  });
});

describe('Mock attachment storage', () => {
  let service: MockAttachmentStorageService;

  afterEach(() => {
    service?.clear();
  });

  it('uploads, downloads, heads, presigns, and deletes', async () => {
    service = createAttachmentStorageService({
      serviceType: AttachmentStorageType.MOCK,
      config,
    }) as MockAttachmentStorageService;

    const key = service.objectKey('asset-1', 'original');
    expect(key).toBe('map-assets/asset-1/original');

    const payload = Buffer.from('hello-map-layer');
    const location = await service.upload({
      key,
      body: payload,
      contentType: 'application/octet-stream',
      contentLength: payload.length,
    });

    expect(location.provider).toBe('s3');
    expect(location.resourceUri).toBe(
      formatS3ResourceUri({
        region: config.region,
        bucket: config.bucket,
        key,
      })
    );
    expect(location.byteSize).toBe(payload.length);

    expect(await service.exists({location})).toBe(true);

    const downloaded = await service.download({location});
    expect((await collectAttachmentBody(downloaded)).equals(payload)).toBe(
      true
    );

    const downloadUrl = await service.getPresignedDownloadURL({location});
    expect(downloadUrl).toContain('mock://attachment-storage/download/');

    const presignedUpload = await service.getPresignedUploadURL({
      key: service.objectKey('asset-1', 'normalized'),
      contentType: 'application/geo+json',
    });
    expect(presignedUpload.url).toContain('mock://attachment-storage/upload/');
    expect(presignedUpload.location.resourceUri).toBe(
      formatS3ResourceUri({
        region: config.region,
        bucket: config.bucket,
        key: 'map-assets/asset-1/normalized',
      })
    );

    await service.delete({location});
    expect(await service.exists({location})).toBe(false);
    expect(service.getStoredObjects()).toHaveLength(0);
  });

  it('rejects creating S3 storage without going through the factory config', () => {
    expect(() =>
      createAttachmentStorageService({
        serviceType: 'NOPE' as AttachmentStorageType,
        config,
      })
    ).toThrow(/Unsupported attachment storage type/);
  });
});
