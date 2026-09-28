import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  E2E_ALLOW_REMOTE_COUCH,
  isLocalCouchHostname,
  parseCouchEnv,
  parseCouchTargetUrl,
} from './env.ts';

describe('isLocalCouchHostname', () => {
  it('accepts loopback names and addresses', () => {
    for (const host of [
      'localhost',
      'LOCALHOST',
      'couch.localhost',
      '127.0.0.1',
      '127.1.2.3',
      '::1',
      '[::1]',
    ]) {
      assert.equal(isLocalCouchHostname(host), true, host);
    }
  });

  it('rejects remote, private, and docker-DNS hosts', () => {
    for (const host of [
      'db.example.com',
      'localhost.evil.com',
      '192.168.1.10',
      '10.0.0.5',
      'couchdb',
      'host.docker.internal',
    ]) {
      assert.equal(isLocalCouchHostname(host), false, host);
    }
  });
});

describe('parseCouchTargetUrl', () => {
  it('parses a local http target', () => {
    const url = parseCouchTargetUrl(
      'http://localhost:5984',
      'COUCHDB_INTERNAL_URL'
    );
    assert.equal(url.hostname, 'localhost');
    assert.equal(url.port, '5984');
  });

  it('throws on a remote host', () => {
    assert.throws(
      () =>
        parseCouchTargetUrl(
          'https://db.fieldmark.app:443',
          'COUCHDB_INTERNAL_URL'
        ),
      /does not look local/
    );
  });

  it('throws on a non-http(s) scheme', () => {
    assert.throws(
      () => parseCouchTargetUrl('ftp://localhost:5984', 'COUCHDB_INTERNAL_URL'),
      /must be http/
    );
  });

  it('throws on an unparseable value', () => {
    assert.throws(
      () => parseCouchTargetUrl('not a url', 'COUCHDB_INTERNAL_URL'),
      /not a valid URL/
    );
  });

  it('allows a remote host when allowRemote is set', () => {
    const url = parseCouchTargetUrl(
      'https://db.example.com',
      'COUCHDB_PUBLIC_URL',
      true
    );
    assert.equal(url.hostname, 'db.example.com');
  });
});

describe('parseCouchEnv', () => {
  it('allows unset Couch targets', () => {
    const parsed = parseCouchEnv({});
    assert.equal(parsed.allowRemote, false);
    assert.equal(parsed.internalUrl, undefined);
  });

  it('throws when a Couch URL is remote', () => {
    assert.throws(
      () =>
        parseCouchEnv({
          COUCHDB_PUBLIC_URL: 'https://db.prod.example',
        }),
      /COUCHDB_PUBLIC_URL/
    );
  });

  it(`allows remote targets when ${E2E_ALLOW_REMOTE_COUCH} is truthy`, () => {
    const parsed = parseCouchEnv({
      COUCHDB_INTERNAL_URL: 'https://db.prod.example',
      [E2E_ALLOW_REMOTE_COUCH]: 'yes',
    });
    assert.equal(parsed.allowRemote, true);
    assert.equal(parsed.internalUrl, 'https://db.prod.example');
  });
});
