// SPDX-License-Identifier: Apache-2.0
/**
 * Process fingerprint for the clustered startup-migration lock.
 *
 * Combines the data-model boot-end-state digest with this instance's JWT
 * public material (`rsa:<kid>` + public PEM). Never hashes the private key.
 * `apiVersion` is stored and logged separately; it is not an input.
 */
import {createHash} from 'node:crypto';
import {
  STARTUP_MIGRATION_FINGERPRINT_LENGTH,
  startupMigrationFingerprint,
} from '@faims3/data-model';
import {keyService} from '../buildconfig';

/**
 * Couch `_config/jwt_keys/` name for a signing key (`rsa:<kid>`).
 * `kid` may already include the `rsa:` prefix.
 */
export function jwtCouchKeyName(kid: string): string {
  return kid.startsWith('rsa:') ? kid : `rsa:${kid}`;
}

export {STARTUP_MIGRATION_FINGERPRINT_LENGTH};

/**
 * Normalise PEM so Windows `\r\n` and Unix `\n` hash identically. Does not
 * JSON-escape newlines (unlike the Couch `_config` write).
 */
export function normalisePublicKeyPem(pem: string): string {
  return pem.replace(/\r/g, '');
}

/**
 * Fold the data-model digest with JWT public identity into the 12-hex
 * fingerprint stored on the lock.
 */
export function combineStartupMigrationFingerprint(options: {
  dataModelFingerprint: string;
  kid: string;
  publicKeyPem: string;
}): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        schema: options.dataModelFingerprint,
        jwt: {
          kid: jwtCouchKeyName(options.kid),
          publicKey: normalisePublicKeyPem(options.publicKeyPem),
        },
      }),
      'utf8'
    )
    .digest('hex');
  return digest.slice(0, STARTUP_MIGRATION_FINGERPRINT_LENGTH);
}

/**
 * This process's lock fingerprint: data-model end-state plus the public
 * signing key. Callers must not log the PEM.
 */
export async function getStartupMigrationFingerprint(): Promise<string> {
  const dataModelFingerprint = await startupMigrationFingerprint();
  const signingKey = await keyService.getSigningKey();
  return combineStartupMigrationFingerprint({
    dataModelFingerprint,
    kid: signingKey.kid,
    publicKeyPem: signingKey.publicKeyString,
  });
}
