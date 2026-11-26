// SPDX-License-Identifier: Apache-2.0

export function decodeBase64KeyPair(
  encodedPrivateKey: string,
  encodedPublicKey: string
): {privateKeyString: string; publicKeyString: string} {
  return {
    privateKeyString: Buffer.from(encodedPrivateKey, 'base64').toString(
      'utf-8'
    ),
    publicKeyString: Buffer.from(encodedPublicKey, 'base64').toString('utf-8'),
  };
}
