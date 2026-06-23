import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {Response} from 'express';
import {once} from 'events';
import {accessSync} from 'fs';
import path from 'path';
import {EXPORT_SERVICE_GRPC_ADDRESS} from '../buildconfig';

type ExportFormat = 'csv' | 'zip' | 'geojson' | 'kml' | 'full';

type FullExportConfig = {
  includeTabular: boolean;
  includeAttachments: boolean;
  includeGeoJSON: boolean;
  includeKML: boolean;
  includeMetadata: boolean;
};

type ExportPayload = {
  projectID: string;
  format: ExportFormat;
  viewID?: string;
  userID: string;
  fullConfig?: FullExportConfig;
};

type GrpcExportRequest = {
  projectId: string;
  format: number;
  viewId?: string;
  userId: string;
  fullConfig?: {
    includeTabular: boolean;
    includeAttachments: boolean;
    includeGeojson: boolean;
    includeKml: boolean;
    includeMetadata: boolean;
  };
};

type FileChunk = {
  data?: Buffer | Uint8Array;
  filename?: string;
  contentType?: string;
  sequence?: number;
};

type ExportServiceClient = {
  Export(request: GrpcExportRequest): grpc.ClientReadableStream<FileChunk>;
};

const FORMAT_TO_GRPC: Record<ExportFormat, number> = {
  csv: 1,
  zip: 2,
  geojson: 3,
  kml: 4,
  full: 5,
};

let cachedClient: ExportServiceClient | undefined;

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

  // Let proto-loader surface the full error with this canonical location.
  return candidates[0];
}

function getExportClient(): ExportServiceClient | undefined {
  if (!EXPORT_SERVICE_GRPC_ADDRESS) {
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
    EXPORT_SERVICE_GRPC_ADDRESS,
    grpc.credentials.createInsecure()
  ) as ExportServiceClient;
  return cachedClient;
}

function toGrpcRequest(payload: ExportPayload): GrpcExportRequest {
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

/**
 * Streams an export through the Go gRPC service when configured.
 *
 * Returns false if no export service is configured or if the gRPC call fails
 * before any bytes are written, allowing the existing in-process exporter to
 * handle the request. Once bytes have been written, failures destroy the HTTP
 * response because the file stream can no longer be safely restarted.
 */
export async function streamNotebookExportViaGrpc({
  payload,
  res,
}: {
  payload: ExportPayload;
  res: Response;
}): Promise<boolean> {
  const client = getExportClient();
  if (!client) {
    return false;
  }

  const stream = client.Export(toGrpcRequest(payload));
  let wroteBytes = false;

  res.on('close', () => {
    if (!res.writableEnded) {
      stream.cancel();
    }
  });

  try {
    for await (const chunk of stream as unknown as AsyncIterable<FileChunk>) {
      const data = chunk.data ? Buffer.from(chunk.data) : undefined;
      if (!data || data.length === 0) {
        continue;
      }
      wroteBytes = true;
      if (!res.write(data)) {
        await once(res, 'drain');
      }
    }
    res.end();
    return true;
  } catch (error) {
    if (wroteBytes || res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return true;
    }
    console.warn('Export service unavailable, falling back to Node exporter.', {
      error,
    });
    return false;
  }
}
