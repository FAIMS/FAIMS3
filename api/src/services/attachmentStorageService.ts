// SPDX-License-Identifier: Apache-2.0
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {type StoredAttachmentLocation} from '@faims3/data-model';
import {createWriteStream} from 'fs';
import {Readable} from 'stream';
import {pipeline} from 'stream/promises';

/**
 * Enum representing the possible attachment storage implementations.
 */
export enum AttachmentStorageType {
  /** AWS S3 or an S3-compatible store (RustFS, MinIO, …). */
  S3 = 'S3',
  /** In-memory mock for tests. */
  MOCK = 'MOCK',
}

/** Readable stream or fully-buffered body accepted by {@link IAttachmentStorageService.upload}. */
export type AttachmentBody = Readable | Buffer | Uint8Array;

/** Shared object-store settings used by every backend. */
export interface AttachmentStorageConfig {
  /** Bucket that holds map-layer objects. */
  bucket: string;
  /** Key prefix (no leading/trailing slash), e.g. `map-assets`. */
  prefix: string;
  /** AWS region, or a dummy region for RustFS (`us-east-1`). */
  region: string;
  /** Custom endpoint for S3-compatible stores. Omit for AWS S3. */
  endpoint?: string;
  /**
   * Host-visible endpoint used when signing download URLs. Needed when
   * the API reaches the store on an internal hostname (e.g. `rustfs`)
   * but browsers/apps use `localhost`.
   */
  publicEndpoint?: string;
  /** Path-style URLs. Required for RustFS / most local S3 clones. */
  forcePathStyle?: boolean;
  /** Optional static credentials. Omit on ECS so the task role is used. */
  accessKeyId?: string;
  /** Optional static credentials. Omit on ECS so the task role is used. */
  secretAccessKey?: string;
}

export interface UploadAttachmentParams {
  /** Object key, usually from {@link IAttachmentStorageService.objectKey}. */
  key: string;
  body: AttachmentBody;
  contentType: string;
  contentLength?: number;
}

export interface PresignedUploadResult {
  url: string;
  location: StoredAttachmentLocation;
}

/**
 * Object-store interface used by map-layer ingest.
 *
 * Implementations must return a {@link StoredAttachmentLocation} whose
 * `resourceUri` the provider can resolve again. S3 uses
 * `s3://region/bucket/key`; `endpoint` is optional for RustFS.
 */
export interface IAttachmentStorageService {
  /** Join the configured prefix with path parts to form a stored key. */
  objectKey(...parts: string[]): string;

  /** Put an object and return the location metadata stored on the Couch document. */
  upload(params: UploadAttachmentParams): Promise<StoredAttachmentLocation>;

  /** Stream an object body from storage. */
  download(params: {location: StoredAttachmentLocation}): Promise<Readable>;

  /** Stream an object onto disk without buffering the whole body. */
  downloadToFile(params: {
    location: StoredAttachmentLocation;
    destPath: string;
  }): Promise<void>;

  /** Time-limited GET URL. `publicEndpoint` is used when browsers cannot reach the internal host. */
  getPresignedDownloadURL(params: {
    location: StoredAttachmentLocation;
    expiresInSeconds?: number;
    contentType?: string;
    filename?: string;
  }): Promise<string>;

  /** Time-limited PUT URL for a client-direct upload. */
  getPresignedUploadURL(params: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedUploadResult>;

  /** Remove an object. Missing keys are not an error. */
  delete(params: {location: StoredAttachmentLocation}): Promise<void>;

  /** True when the object is present. */
  exists(params: {location: StoredAttachmentLocation}): Promise<boolean>;
}

const DEFAULT_PRESIGN_EXPIRY_SECONDS = 15 * 60;

/** Strip leading and trailing slashes from an object-key prefix. */
export function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '');
}

/**
 * Join prefix + path parts into an object key, dropping `..` and empty
 * segments so a filename cannot walk out of the prefix.
 */
export function joinObjectKey(prefix: string, ...parts: string[]): string {
  const normalized = normalizePrefix(prefix);
  const safe = parts
    .flatMap(part => part.split('/'))
    .map(part => part.replace(/\.\./g, ''))
    .filter(part => part.length > 0 && part !== '.');
  return [normalized, ...safe].filter(part => part.length > 0).join('/');
}

/**
 * S3 resource URI stored on the Couch document:
 * `s3://{region}/{bucket}/{key}` (key may contain slashes).
 */
export function formatS3ResourceUri({
  region,
  bucket,
  key,
}: {
  region: string;
  bucket: string;
  key: string;
}): string {
  return `s3://${region}/${bucket}/${key.replace(/^\/+/, '')}`;
}

/**
 * Split `s3://{region}/{bucket}/{key}` back into parts.
 * Throws when the URI is missing any component.
 */
export function parseS3ResourceUri(resourceUri: string): {
  region: string;
  bucket: string;
  key: string;
} {
  if (!resourceUri.startsWith('s3://')) {
    throw new Error(
      `S3 resourceUri must start with s3://, got "${resourceUri}".`
    );
  }
  const rest = resourceUri.slice('s3://'.length);
  const [region, bucket, ...keyParts] = rest.split('/');
  const key = keyParts.join('/');
  if (!region || !bucket || !key) {
    throw new Error(
      `Invalid S3 resourceUri "${resourceUri}". Expected s3://region/bucket/key.`
    );
  }
  return {region, bucket, key};
}

/** Buffer an upload/download body (Buffer, Uint8Array, or async iterable). */
export async function collectAttachmentBody(
  body: AttachmentBody
): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    );
  }
  return Buffer.concat(chunks as unknown as Uint8Array[]);
}

abstract class BaseAttachmentStorageService implements IAttachmentStorageService {
  protected config: AttachmentStorageConfig;

  constructor({config}: {config: AttachmentStorageConfig}) {
    this.config = {
      ...config,
      prefix: normalizePrefix(config.prefix),
    };
  }

  /** Object key under the configured prefix. */
  objectKey(...parts: string[]): string {
    return joinObjectKey(this.config.prefix, ...parts);
  }

  /** Build Couch location metadata for a key that was just written. */
  protected locationFor({
    key,
    contentType,
    byteSize,
  }: {
    key: string;
    contentType: string;
    byteSize: number;
  }): StoredAttachmentLocation {
    return {
      provider: 's3',
      resourceUri: formatS3ResourceUri({
        region: this.config.region,
        bucket: this.config.bucket,
        key,
      }),
      contentType,
      byteSize,
      ...(this.config.endpoint ? {endpoint: this.config.endpoint} : {}),
    };
  }

  abstract upload(
    params: UploadAttachmentParams
  ): Promise<StoredAttachmentLocation>;
  abstract download(params: {
    location: StoredAttachmentLocation;
  }): Promise<Readable>;
  abstract downloadToFile(params: {
    location: StoredAttachmentLocation;
    destPath: string;
  }): Promise<void>;
  abstract getPresignedDownloadURL(params: {
    location: StoredAttachmentLocation;
    expiresInSeconds?: number;
    contentType?: string;
    filename?: string;
  }): Promise<string>;
  abstract getPresignedUploadURL(params: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedUploadResult>;
  abstract delete(params: {location: StoredAttachmentLocation}): Promise<void>;
  abstract exists(params: {
    location: StoredAttachmentLocation;
  }): Promise<boolean>;
}

/**
 * AWS SDK client options: custom endpoint for RustFS, path-style when
 * needed, and explicit keys when they are not coming from the default chain.
 */
function s3ClientConfig(
  config: AttachmentStorageConfig,
  endpointOverride?: string
): S3ClientConfig {
  const endpoint = endpointOverride ?? config.endpoint;
  const clientConfig: S3ClientConfig = {
    region: config.region,
  };
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = config.forcePathStyle !== false;
  } else if (config.forcePathStyle) {
    clientConfig.forcePathStyle = true;
  }
  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }
  return clientConfig;
}

/** Coerce an S3 GetObject body to a Node `Readable`. */
function asNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }
  const transformToWebStream = (
    body as {transformToWebStream?: () => ReadableStream}
  ).transformToWebStream;
  if (typeof transformToWebStream === 'function') {
    return Readable.fromWeb(
      transformToWebStream.call(body) as import('stream/web').ReadableStream
    );
  }
  throw new Error('Unexpected S3 GetObject body type.');
}

/**
 * S3 / RustFS implementation. Static keys are optional: on ECS the default
 * credential provider chain uses the task role.
 */
export class S3AttachmentStorageService extends BaseAttachmentStorageService {
  private client: S3Client;
  /** Signs download URLs with a host browsers can reach. */
  private presignClient: S3Client;
  private ready: Promise<void> | undefined;

  constructor({config}: {config: AttachmentStorageConfig}) {
    super({config});
    this.client = new S3Client(s3ClientConfig(this.config));
    this.presignClient =
      this.config.publicEndpoint &&
      this.config.publicEndpoint !== this.config.endpoint
        ? new S3Client(s3ClientConfig(this.config, this.config.publicEndpoint))
        : this.client;
  }

  /** Create the bucket once; later calls share the same in-flight promise. */
  private async ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.ensureBucket().catch(error => {
        this.ready = undefined;
        throw error;
      });
    }
    await this.ready;
  }

  /**
   * Head the bucket and create it when missing. 403 is ignored so a
   * locked-down policy can still upload into an existing bucket.
   */
  private async ensureBucket(): Promise<void> {
    let missing = false;
    try {
      await this.client.send(
        new HeadBucketCommand({Bucket: this.config.bucket})
      );
    } catch (error) {
      const status = (error as {$metadata?: {httpStatusCode?: number}})
        .$metadata?.httpStatusCode;
      const name = (error as {name?: string}).name;
      missing =
        status === 404 ||
        name === 'NotFound' ||
        name === 'NoSuchBucket' ||
        name === 'NotFoundException';
      if (!missing) {
        // 403 / network: bucket may already exist; the next op will fail clearly.
        return;
      }
    }
    if (missing) {
      const create: ConstructorParameters<typeof CreateBucketCommand>[0] = {
        Bucket: this.config.bucket,
      };
      if (this.config.region !== 'us-east-1') {
        create.CreateBucketConfiguration = {
          LocationConstraint: this.config.region as never,
        };
      }
      await this.client.send(new CreateBucketCommand(create));
    }
    await this.ensureBrowserCors();
  }

  /**
   * Local S3 clones need CORS so the browser can GET a presigned object.
   * AWS CORS is set in CDK; PutBucketCORS is not on the task-role grant.
   */
  private async ensureBrowserCors(): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.config.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: [
                'Content-Length',
                'Content-Type',
                'Content-Disposition',
              ],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
  }

  /** Multipart-upload `body` to S3/RustFS and return the stored location. */
  async upload({
    key,
    body,
    contentType,
    contentLength,
  }: UploadAttachmentParams): Promise<StoredAttachmentLocation> {
    await this.ensureReady();
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(contentLength !== undefined ? {ContentLength: contentLength} : {}),
      },
    });
    await upload.done();
    const byteSize =
      contentLength ??
      (Buffer.isBuffer(body) || body instanceof Uint8Array
        ? body.byteLength
        : 0);
    return this.locationFor({key, contentType, byteSize});
  }

  /** GetObject as a Node readable. */
  async download({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<Readable> {
    await this.ensureReady();
    const {bucket, key} = parseS3ResourceUri(location.resourceUri);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    if (!response.Body) {
      throw new Error(`S3 object ${location.resourceUri} has no body.`);
    }
    return asNodeReadable(response.Body);
  }

  /** Pipe GetObject onto `destPath`. */
  async downloadToFile({
    location,
    destPath,
  }: {
    location: StoredAttachmentLocation;
    destPath: string;
  }): Promise<void> {
    const body = await this.download({location});
    await pipeline(body, createWriteStream(destPath));
  }

  /** Host-reachable signed GET, using `publicEndpoint` when set. */
  async getPresignedDownloadURL({
    location,
    expiresInSeconds = DEFAULT_PRESIGN_EXPIRY_SECONDS,
    contentType,
    filename,
  }: {
    location: StoredAttachmentLocation;
    expiresInSeconds?: number;
    contentType?: string;
    filename?: string;
  }): Promise<string> {
    await this.ensureReady();
    const {bucket, key} = parseS3ResourceUri(location.resourceUri);
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(contentType ? {ResponseContentType: contentType} : {}),
        ...(filename
          ? {
              ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
            }
          : {}),
      }),
      {expiresIn: expiresInSeconds}
    );
  }

  /** Signed PUT for a client-direct upload. */
  async getPresignedUploadURL({
    key,
    contentType,
    expiresInSeconds = DEFAULT_PRESIGN_EXPIRY_SECONDS,
  }: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedUploadResult> {
    await this.ensureReady();
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
      }),
      {expiresIn: expiresInSeconds}
    );
    return {
      url,
      location: this.locationFor({key, contentType, byteSize: 0}),
    };
  }

  /** DeleteObject; a missing key is not an error. */
  async delete({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<void> {
    await this.ensureReady();
    const {bucket, key} = parseS3ResourceUri(location.resourceUri);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  /** HeadObject; 404 is `false`. */
  async exists({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<boolean> {
    await this.ensureReady();
    try {
      const {bucket, key} = parseS3ResourceUri(location.resourceUri);
      await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      const status = (error as {$metadata?: {httpStatusCode?: number}})
        .$metadata?.httpStatusCode;
      const name = (error as {name?: string}).name;
      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }
}

interface StoredMockObject {
  bytes: Buffer;
  location: StoredAttachmentLocation;
}

/**
 * In-memory attachment store for tests. Presigned URLs are `mock://` tokens
 * and cannot be fetched over HTTP.
 */
export class MockAttachmentStorageService extends BaseAttachmentStorageService {
  private objects = new Map<string, StoredMockObject>();

  async upload({
    key,
    body,
    contentType,
    contentLength,
  }: UploadAttachmentParams): Promise<StoredAttachmentLocation> {
    const bytes = await collectAttachmentBody(body);
    const location = this.locationFor({
      key,
      contentType,
      byteSize: contentLength ?? bytes.length,
    });
    this.objects.set(this.objectMapKey(location), {bytes, location});
    return location;
  }

  async download({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<Readable> {
    const stored = this.objects.get(this.objectMapKey(location));
    if (!stored) {
      throw new Error(`Mock attachment ${location.resourceUri} was not found.`);
    }
    return Readable.from(stored.bytes);
  }

  async downloadToFile({
    location,
    destPath,
  }: {
    location: StoredAttachmentLocation;
    destPath: string;
  }): Promise<void> {
    const body = await this.download({location});
    await pipeline(body, createWriteStream(destPath));
  }

  async getPresignedDownloadURL({
    location,
  }: {
    location: StoredAttachmentLocation;
    expiresInSeconds?: number;
  }): Promise<string> {
    if (!this.objects.has(this.objectMapKey(location))) {
      throw new Error(`Mock attachment ${location.resourceUri} was not found.`);
    }
    return `mock://attachment-storage/download/${location.resourceUri}`;
  }

  async getPresignedUploadURL({
    key,
    contentType,
  }: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<PresignedUploadResult> {
    return {
      url: `mock://attachment-storage/upload/${this.config.bucket}/${key}`,
      location: this.locationFor({key, contentType, byteSize: 0}),
    };
  }

  async delete({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<void> {
    this.objects.delete(this.objectMapKey(location));
  }

  async exists({
    location,
  }: {
    location: StoredAttachmentLocation;
  }): Promise<boolean> {
    return this.objects.has(this.objectMapKey(location));
  }

  /** Snapshot of objects currently in the mock store (tests). */
  getStoredObjects(): StoredMockObject[] {
    return [...this.objects.values()];
  }

  /** Empty the mock store. */
  clear(): void {
    this.objects.clear();
  }

  /** Map key for a stored location (the resource URI). */
  private objectMapKey(location: StoredAttachmentLocation): string {
    return location.resourceUri;
  }
}

interface CreateAttachmentStorageServiceParams {
  serviceType: AttachmentStorageType;
  config: AttachmentStorageConfig;
}

/**
 * Creates an attachment storage implementation. All config is passed in so
 * this module does not import `buildconfig` (circular: buildconfig constructs
 * the singleton).
 */
export function createAttachmentStorageService({
  serviceType,
  config,
}: CreateAttachmentStorageServiceParams): IAttachmentStorageService {
  switch (serviceType) {
    case AttachmentStorageType.S3:
      return new S3AttachmentStorageService({config});
    case AttachmentStorageType.MOCK:
      return new MockAttachmentStorageService({config});
    default:
      throw new Error(`Unsupported attachment storage type: ${serviceType}`);
  }
}
