import {Request, Response} from 'express';
import {once} from 'events';
import {
  EXPORT_SERVICE_GRPC_URL,
  EXPORT_SERVICE_MODE,
} from '../buildconfig';
import {
  exportCallMetadata,
  exportCallOptions,
  getExportServiceClient,
  iterateExportChunks,
  toGrpcRequest,
} from './exportServiceClient';
import {ExportPayload, ExportServiceMode} from './exportTypes';

type StreamExportOptions = {
  req?: Request;
  res: Response;
  payload: ExportPayload;
  legacy: () => void | Promise<void>;
};

type RolloutConfig = {
  mode: ExportServiceMode;
  url?: string;
};

let rolloutOverride: RolloutConfig | undefined;

export function setExportRolloutForTests(config: RolloutConfig | undefined): void {
  rolloutOverride = config;
}

export function resetExportRolloutForTests(): void {
  rolloutOverride = undefined;
}

function getRolloutConfig(): RolloutConfig {
  if (rolloutOverride) {
    return rolloutOverride;
  }
  return {
    mode: EXPORT_SERVICE_MODE,
    url: EXPORT_SERVICE_GRPC_URL,
  };
}

function shouldAttemptGrpc(): boolean {
  const {mode, url} = getRolloutConfig();
  if (mode === 'legacy') {
    return false;
  }
  if (mode === 'grpc') {
    return Boolean(url);
  }
  return Boolean(url);
}

async function pipeGrpcExportToResponse({
  res,
  payload,
}: {
  res: Response;
  payload: ExportPayload;
}): Promise<'completed' | 'pre_stream_failure'> {
  const client = getExportServiceClient();
  if (!client) {
    return 'pre_stream_failure';
  }

  const stream = client.Export(
    toGrpcRequest(payload),
    exportCallMetadata(),
    exportCallOptions()
  );
  let wroteBytes = false;

  const onClientClose = () => {
    if (!res.writableEnded) {
      (stream as {cancel?: () => void}).cancel?.();
    }
  };
  res.on('close', onClientClose);

  try {
    for await (const chunk of iterateExportChunks(stream)) {
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
    return 'completed';
  } catch (error) {
    if (wroteBytes || res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return 'completed';
    }
    throw error;
  } finally {
    res.off('close', onClientClose);
  }
}

/**
 * Routes an export through the Go gRPC sidecar when rollout mode allows it.
 *
 * In `auto` mode, pre-stream gRPC failures fall back to the legacy Node exporter.
 * Mid-stream failures destroy the HTTP response because partial downloads cannot
 * be safely restarted.
 */
export async function streamExportResponse({
  res,
  payload,
  legacy,
}: StreamExportOptions): Promise<void> {
  if (!shouldAttemptGrpc()) {
    await legacy();
    return;
  }

  try {
    const result = await pipeGrpcExportToResponse({res, payload});
    if (result === 'completed') {
      return;
    }
  } catch (error) {
    if (getRolloutConfig().mode === 'grpc') {
      throw error;
    }
    console.warn('Export service unavailable, falling back to Node exporter.', {
      error,
    });
  }

  await legacy();
}
