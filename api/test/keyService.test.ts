// SPDX-License-Identifier: Apache-2.0

import {generateKeyPairSync} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {decodeBase64KeyPair} from '../src/services/keyEnv';

describe('environment signing keys', () => {
  it('decodes the PEM public key for CouchDB', () => {
    const {privateKey, publicKey} = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
      publicKeyEncoding: {type: 'spki', format: 'pem'},
    });

    const decoded = decodeBase64KeyPair(
      Buffer.from(privateKey).toString('base64'),
      Buffer.from(publicKey).toString('base64')
    );

    expect(decoded.privateKeyString).toBe(privateKey);
    expect(decoded.publicKeyString).toBe(publicKey);
    expect(decoded.publicKeyString).toMatch(/^-----BEGIN PUBLIC KEY-----/);
  });
});
