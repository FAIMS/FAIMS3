import {EventEmitter} from 'events';
import {expect} from 'chai';
import {Response} from 'express';
import {Readable} from 'stream';
import {
  resetExportRolloutForTests,
  setExportRolloutForTests,
  streamExportResponse,
} from '../src/services/exportHttpStreamer';
import {
  resetExportServiceClientForTests,
  setExportServiceClientForTests,
} from '../src/services/exportServiceClient';
import {ExportPayload} from '../src/services/exportTypes';

type MockResponse = Response & {
  writableEnded: boolean;
  headersSent: boolean;
  body: Buffer[];
  destroyError?: Error;
};

function mockResponse(): MockResponse {
  const res = new EventEmitter() as MockResponse;
  res.writableEnded = false;
  res.headersSent = false;
  res.body = [];
  res.write = ((chunk: Buffer) => {
    res.headersSent = true;
    res.body.push(Buffer.from(chunk));
    return true;
  }) as MockResponse['write'];
  res.end = (() => {
    res.writableEnded = true;
    res.emit('finish');
  }) as MockResponse['end'];
  res.destroy = ((error?: Error) => {
    res.destroyError = error;
    res.emit('close');
    return res as MockResponse;
  }) as MockResponse['destroy'];
  return res;
}

function chunkStream(chunks: Buffer[]): Readable {
  return Readable.from(
    chunks.map(data => ({data})),
    {objectMode: true}
  );
}

describe('export service streamer', () => {
  const payload: ExportPayload = {
    projectID: 'proj-1',
    format: 'csv',
    viewID: 'FORM1',
    userID: 'user-1',
  };

  afterEach(() => {
    resetExportServiceClientForTests();
    resetExportRolloutForTests();
  });

  it('pipes gRPC chunks to the HTTP response in grpc mode', async () => {
    setExportRolloutForTests({mode: 'grpc', url: 'localhost:9090'});

    const stream = chunkStream([Buffer.from('a'), Buffer.from('b')]);
    setExportServiceClientForTests({
      Export: () => stream,
    });

    const res = mockResponse();
    let legacyCalled = false;
    await streamExportResponse({
      res,
      payload,
      legacy: async () => {
        legacyCalled = true;
      },
    });

    expect(legacyCalled).to.equal(false);
    expect(Buffer.concat(res.body as Uint8Array[]).toString()).to.equal('ab');
    expect(res.writableEnded).to.equal(true);
  });

  it('uses legacy mode without calling gRPC', async () => {
    setExportRolloutForTests({mode: 'legacy', url: 'localhost:9090'});

    let exportCalled = false;
    setExportServiceClientForTests({
      Export: () => {
        exportCalled = true;
        return chunkStream([]);
      },
    });

    const res = mockResponse();
    let legacyCalled = false;
    await streamExportResponse({
      res,
      payload,
      legacy: async () => {
        legacyCalled = true;
      },
    });

    expect(legacyCalled).to.equal(true);
    expect(exportCalled).to.equal(false);
  });

  it('destroys the response on mid-stream failure after bytes are written', async () => {
    setExportRolloutForTests({mode: 'grpc', url: 'localhost:9090'});

    const stream = new Readable({
      objectMode: true,
      read() {
        this.push({data: Buffer.from('partial')});
        this.destroy(new Error('stream failed'));
      },
    });
    setExportServiceClientForTests({
      Export: () => stream,
    });

    const res = mockResponse();
    await streamExportResponse({
      res,
      payload,
      legacy: async () => {
        throw new Error('legacy should not run');
      },
    });

    expect(res.destroyError).to.be.instanceOf(Error);
    expect(Buffer.concat(res.body as Uint8Array[]).toString()).to.equal(
      'partial'
    );
  });

  it('falls back to legacy on pre-stream failure in auto mode', async () => {
    setExportRolloutForTests({mode: 'auto', url: 'localhost:9090'});

    setExportServiceClientForTests({
      Export: () => {
        throw new Error('connection refused');
      },
    });

    const res = mockResponse();
    let legacyCalled = false;
    await streamExportResponse({
      res,
      payload,
      legacy: async () => {
        legacyCalled = true;
      },
    });

    expect(legacyCalled).to.equal(true);
    expect(res.writableEnded).to.equal(false);
  });
});
