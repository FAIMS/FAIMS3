// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it, vi} from 'vitest';
import {STARTUP_MIGRATION_FINGERPRINT_LENGTH} from '@faims3/data-model';

const getSigningKey = vi.hoisted(() => vi.fn());

vi.mock('../src/buildconfig', () => ({
  config: {apiVersion: '1.11.0'},
  keyService: {getSigningKey},
}));

import {
  combineStartupMigrationFingerprint,
  getStartupMigrationFingerprint,
  jwtCouchKeyName,
  normalisePublicKeyPem,
} from '../src/couchdb/startupMigrationFingerprint';

const HEX12 = new RegExp(`^[0-9a-f]{${STARTUP_MIGRATION_FINGERPRINT_LENGTH}}$`);

const PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
-----END PUBLIC KEY-----
`;

describe('startupMigrationFingerprint (API)', () => {
  it('jwtCouchKeyName is rsa:<kid> and is idempotent', () => {
    expect(jwtCouchKeyName('abc')).toBe('rsa:abc');
    expect(jwtCouchKeyName('rsa:abc')).toBe('rsa:abc');
  });

  it('normalisePublicKeyPem strips CR so Windows and Unix PEMs match', () => {
    expect(normalisePublicKeyPem('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('combineStartupMigrationFingerprint is a stable 12-hex digest', () => {
    const first = combineStartupMigrationFingerprint({
      dataModelFingerprint: 'aabbccddeeff',
      kid: 'test-kid',
      publicKeyPem: PUBLIC_PEM,
    });
    const second = combineStartupMigrationFingerprint({
      dataModelFingerprint: 'aabbccddeeff',
      kid: 'test-kid',
      publicKeyPem: PUBLIC_PEM.replace(/\n/g, '\r\n'),
    });
    expect(first).toMatch(HEX12);
    expect(first).toBe(second);
  });

  it('changes when kid or public PEM changes, not when a private key is nearby', () => {
    const base = combineStartupMigrationFingerprint({
      dataModelFingerprint: 'aabbccddeeff',
      kid: 'test-kid',
      publicKeyPem: PUBLIC_PEM,
    });
    expect(
      combineStartupMigrationFingerprint({
        dataModelFingerprint: 'aabbccddeeff',
        kid: 'other-kid',
        publicKeyPem: PUBLIC_PEM,
      })
    ).not.toBe(base);
    expect(
      combineStartupMigrationFingerprint({
        dataModelFingerprint: 'aabbccddeeff',
        kid: 'test-kid',
        publicKeyPem: PUBLIC_PEM.replace('MIIB', 'XXXX'),
      })
    ).not.toBe(base);
    expect(base).not.toContain('PRIVATE');
    expect(base).not.toContain(PUBLIC_PEM);
  });

  it('changes when the data-model digest changes', () => {
    const a = combineStartupMigrationFingerprint({
      dataModelFingerprint: 'aaaaaaaaaaaa',
      kid: 'test-kid',
      publicKeyPem: PUBLIC_PEM,
    });
    const b = combineStartupMigrationFingerprint({
      dataModelFingerprint: 'bbbbbbbbbbbb',
      kid: 'test-kid',
      publicKeyPem: PUBLIC_PEM,
    });
    expect(a).not.toBe(b);
  });

  it('getStartupMigrationFingerprint uses the signing public key, not the private key', async () => {
    getSigningKey.mockResolvedValue({
      alg: 'RS256',
      kid: 'unit-test-kid',
      privateKey: 'DO-NOT-HASH-ME',
      publicKey: 'public',
      publicKeyString: PUBLIC_PEM,
      instanceName: 'test',
    });
    const fingerprint = await getStartupMigrationFingerprint();
    expect(fingerprint).toMatch(HEX12);
    expect(fingerprint).not.toContain('DO-NOT-HASH-ME');
    expect(getSigningKey).toHaveBeenCalled();
  });
});
