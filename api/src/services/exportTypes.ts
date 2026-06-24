import * as grpc from '@grpc/grpc-js';

export type ExportFormat =
  | 'csv'
  | 'zip'
  | 'geojson'
  | 'kml'
  | 'full'
  | 'json_records';

export type ExportServiceMode = 'auto' | 'grpc' | 'legacy';

export type FullExportConfig = {
  includeTabular: boolean;
  includeAttachments: boolean;
  includeGeoJSON: boolean;
  includeKML: boolean;
  includeMetadata: boolean;
};

export type ExportPayload = {
  projectID: string;
  format: ExportFormat;
  viewID?: string;
  userID: string;
  fullConfig?: FullExportConfig;
};

export type GrpcExportRequest = {
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

export type FileChunk = {
  data?: Buffer | Uint8Array;
  filename?: string;
  contentType?: string;
  sequence?: number;
};

export type ExportServiceClient = {
  Export(
    request: GrpcExportRequest,
    metadata?: grpc.Metadata,
    options?: grpc.CallOptions
  ): NodeJS.ReadableStream;
};
