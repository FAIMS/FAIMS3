import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {accessSync} from 'fs';
import path from 'path';
import {
  EXPORT_SERVICE_GRPC_DEADLINE_MS,
  EXPORT_SERVICE_GRPC_URL,
  EXPORT_SERVICE_SHARED_SECRET,
} from '../buildconfig';
import {
  ExportPayload,
  ExportServiceClient,
  FileChunk,
  GrpcExportRequest,
} from './exportTypes';

const FORMAT_TO_GRPC: Record<ExportPayload['format'], number> = {
  csv: 1,
  zip: 2,
  geojson: 3,
  kml: 4,
  full: 5,
  json_records: 6,
};

let cachedClient: ExportServiceClient | undefined;
let clientOverride: ExportServiceClient | undefined;

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto/export.proto'),
    path.resolve(__dirname, '../../../proto/export.proto'),
    path.resolve(__dirname, '../../../../proto/export.proto'),
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return candidates[0];
}

export function getExportServiceClient(): ExportServiceClient | undefined {
  if (clientOverride) {
    return clientOverride;
  }
  if (!EXPORT_SERVICE_GRPC_URL) {
    return undefined;
  }
  if (cachedClient) {
    return cachedClient;
  }

  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
    keepCase: false,
    longs: String,
    enums: Number,
    defaults: false,
    oneofs: true,
    bytes: Buffer,
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition) as any;
  const ExportService = loaded.faims.export.v1.ExportService;
  cachedClient = new ExportService(
    EXPORT_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
  ) as ExportServiceClient;
  return cachedClient;
}

export function setExportServiceClientForTests(
  client: ExportServiceClient | undefined
): void {
  clientOverride = client;
  cachedClient = undefined;
}

export function resetExportServiceClientForTests(): void {
  clientOverride = undefined;
  cachedClient = undefined;
}

export function toGrpcRequest(payload: ExportPayload): GrpcExportRequest {
  return {
    projectId: payload.projectID,
    format: FORMAT_TO_GRPC[payload.format],
    viewId: payload.viewID,
    userId: payload.userID,
    fullConfig: payload.fullConfig
      ? {
          includeTabular: payload.fullConfig.includeTabular,
          includeAttachments: payload.fullConfig.includeAttachments,
          includeGeojson: payload.fullConfig.includeGeoJSON,
          includeKml: payload.fullConfig.includeKML,
          includeMetadata: payload.fullConfig.includeMetadata,
        }
      : undefined,
  };
}

export function exportCallMetadata(): grpc.Metadata {
  const metadata = new grpc.Metadata();
  if (EXPORT_SERVICE_SHARED_SECRET) {
    metadata.set('x-export-service-secret', EXPORT_SERVICE_SHARED_SECRET);
  }
  return metadata;
}

export function exportCallOptions(): grpc.CallOptions {
  if (!EXPORT_SERVICE_GRPC_DEADLINE_MS) {
    return {};
  }
  const deadline = new Date(Date.now() + EXPORT_SERVICE_GRPC_DEADLINE_MS);
  return {deadline};
}

export async function* iterateExportChunks(
  stream: NodeJS.ReadableStream
): AsyncGenerator<FileChunk> {
  for await (const chunk of stream as AsyncIterable<FileChunk>) {
    yield chunk;
  }
}
