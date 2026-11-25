// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {config} from '../src/buildconfig';
import {databaseValidityReport, verifyCouchDBConnection} from '../src/couchdb';
import {attachFullApi} from '../src/expressSetup';
import {createHealthApp} from '../src/healthApp';

describe('health-only app', () => {
  const app = createHealthApp();

  it('GET /up is 200 without Couch', async () => {
    const result = await request(app).get('/up');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({status: 'ok'});
  });

  it('does not register GET / as liveness', async () => {
    const result = await request(app).get('/');
    expect(result.statusCode).toBe(404);
  });

  it('does not register API routes', async () => {
    const result = await request(app).get('/api/notebooks');
    expect(result.statusCode).toBe(404);
  });

  it('does not register /health or /ready', async () => {
    expect((await request(app).get('/health')).statusCode).toBe(404);
    expect((await request(app).get('/ready')).statusCode).toBe(404);
  });
});

describe('health-only then attachFullApi', () => {
  it('GET /up stays liveness; GET / is login after attach; /ready appears then', async () => {
    const app = createHealthApp();

    const rootBefore = await request(app).get('/');
    expect(rootBefore.statusCode).toBe(404);

    const upBefore = await request(app).get('/up');
    expect(upBefore.statusCode).toBe(200);
    expect(upBefore.body).toEqual({status: 'ok'});

    expect((await request(app).get('/ready')).statusCode).toBe(404);

    attachFullApi(app);

    const rootAfter = await request(app).get('/');
    expect(rootAfter.statusCode).toBe(302);
    expect(rootAfter.headers.location).toMatch(/\/login/);

    const upAfter = await request(app).get('/up');
    expect(upAfter.statusCode).toBe(200);
    expect(upAfter.body).toEqual({status: 'ok'});

    const readyAfter = await request(app).get('/ready');
    expect(readyAfter.statusCode).toBe(200);
    expect(readyAfter.body).toEqual({ready: true});
  });
});

describe('GET / fallback HTML', () => {
  const originalReport = {
    valid: databaseValidityReport.valid,
    canReachServer: databaseValidityReport.canReachServer,
    missingDatabases: [...databaseValidityReport.missingDatabases],
    unreachableDatabases: [...databaseValidityReport.unreachableDatabases],
    server_msg: databaseValidityReport.server_msg,
    database_errors: databaseValidityReport.database_errors,
    validate_error: databaseValidityReport.validate_error,
  };
  const originalPublicUrl = config.couchdbPublicUrl;
  const originalInternalUrl = config.couchdbInternalUrl;

  afterEach(() => {
    databaseValidityReport.valid = originalReport.valid;
    databaseValidityReport.canReachServer = originalReport.canReachServer;
    databaseValidityReport.missingDatabases = [
      ...originalReport.missingDatabases,
    ];
    databaseValidityReport.unreachableDatabases = [
      ...originalReport.unreachableDatabases,
    ];
    databaseValidityReport.server_msg = originalReport.server_msg;
    databaseValidityReport.database_errors = originalReport.database_errors;
    databaseValidityReport.validate_error = originalReport.validate_error;
    config.couchdbPublicUrl = originalPublicUrl;
    config.couchdbInternalUrl = originalInternalUrl;
  });

  it('renders the public Couch URL and public-safe copy, not the VPC hostname', async () => {
    const app = createHealthApp();
    attachFullApi(app);

    config.couchdbPublicUrl = 'https://db.example.com:443';
    config.couchdbInternalUrl = 'http://couchdb.internal.example.com:5984';

    const report = await verifyCouchDBConnection();
    expect(report.valid).toBe(false);
    expect(report.canReachServer).toBe(false);
    expect(report.server_msg).toContain(
      'http://couchdb.internal.example.com:5984'
    );

    const result = await request(app).get('/');
    expect(result.statusCode).toBe(200);
    expect(result.text).toContain('https://db.example.com:443');
    expect(result.text).toContain('Unable to connect to the database server.');
    expect(result.text).not.toContain('couchdb.internal');
    expect(result.text).not.toContain(
      'http://couchdb.internal.example.com:5984'
    );
    expect(result.text).not.toContain(report.server_msg ?? 'NO_MSG');
  });

  it('lists missing database names without operator error detail', async () => {
    const app = createHealthApp();
    attachFullApi(app);

    config.couchdbPublicUrl = 'https://db.example.com:443';
    config.couchdbInternalUrl = 'http://couchdb.internal.example.com:5984';

    databaseValidityReport.valid = false;
    databaseValidityReport.canReachServer = true;
    databaseValidityReport.missingDatabases = ['people'];
    databaseValidityReport.unreachableDatabases = ['auth'];
    databaseValidityReport.server_msg = '';
    databaseValidityReport.database_errors = [
      'Unable to connect to CouchDB database auth: getaddrinfo ENOTFOUND couchdb.internal.example.com',
    ];

    const result = await request(app).get('/');
    expect(result.statusCode).toBe(200);
    expect(result.text).toContain('Able to connect to database server.');
    expect(result.text).toContain('Database people not found');
    expect(result.text).toContain('Unable to connect to database auth');
    expect(result.text).toContain('Run Database Initialisation');
    expect(result.text).not.toContain('couchdb.internal');
    expect(result.text).not.toContain('ENOTFOUND');
  });
});
