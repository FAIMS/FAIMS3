// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   Server configuration. Env-backed scalars and server-specific derivation
 *   (signing-key identity, Couch auth, token lifetimes, email/SMTP) are
 *   parsed by `@faims3/build-config` (`parseApiEnv`). This module layers on
 *   Node-only work: key-file existence, cookie-secret already filled by the
 *   parser, and the key/email service singletons.
 *   Prefer importing `{config}` and reading `config.<field>`.
 */

import {parseApiEnv, SHARED_DEFAULTS} from '@faims3/build-config';
import {slugify} from '@faims3/data-model';
import {existsSync} from 'fs';
import {
  createEmailService,
  EmailServiceType,
  IEmailService,
} from './services/emailService';
import {getKeyService, IKeyService, KeySource} from './services/keyService';

import {version as packageVersion} from '../package.json';

console.log(`Using API version from package.json: ${packageVersion}`);

/** Fallback export-limiter window (10 min) if a caller needs the constant. */
export const DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS =
  SHARED_DEFAULTS.exportRateLimiterWindowMs;
/** Fallback export-limiter allowance if a caller needs the constant. */
export const DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW =
  SHARED_DEFAULTS.exportRateLimiterPerWindow;

const parsed = parseApiEnv(process.env);

const keyFilePath = existsSync(parsed.keyFilePath) ? parsed.keyFilePath : '.';

/**
 * The singleton configuration object. Prefer reading values from here.
 *
 * Note: intentionally not frozen so that tests can override individual values
 * at runtime (e.g. provisioning policy) via `config.<field> = ...`.
 */
export const config = {
  ...parsed,
  keyFilePath,
  keySource: parsed.keySource as KeySource,
  apiVersion: packageVersion,
  /** Directory / invite server id; same slug rules as `@faims3/data-model`. */
  conductorServerId: slugify(parsed.conductorInstanceName),
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Key file paths (lazy). Filenames match makeInstanceKeys.sh:
//   keys/<host>_{private,public}_key.pem
// ---------------------------------------------------------------------------

/** Absolute path to the PEM private key used for JWT signing. */
export function privateKeyPath(): string {
  const keyfile = `${config.keyFilePath}/keys/${config.keyFileHost}_private_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Private key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Private key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

/** Absolute path to the PEM public key paired with `privateKeyPath()`. */
export function publicKeyPath(): string {
  const keyfile = `${config.keyFilePath}/keys/${config.keyFileHost}_public_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Public key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Public key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

/**
 * Fail-fast local checks before the health listener binds. No Couch.
 * FILE keys are also validated when {@link keyService} is constructed.
 */
export function assertLocalStartupConfig(): void {
  if (config.keySource === KeySource.FILE) {
    privateKeyPath();
    publicKeyPath();
    return;
  }
  if (config.keySource === KeySource.ENV) {
    const privateKey = process.env.PRIVATE_SIGNING_KEY?.trim();
    const publicKey = process.env.PUBLIC_SIGNING_KEY?.trim();
    if (!privateKey || !publicKey) {
      throw new Error(
        'PRIVATE_SIGNING_KEY or PUBLIC_SIGNING_KEY environment variable not set but KEY_SOURCE is ENV'
      );
    }
  }
}

/** Signing-key singleton. */
export const keyService: IKeyService = getKeyService(config.keySource);

/** Email singleton. Tests may stub methods on this instance. */
export const emailService: IEmailService = createEmailService({
  serviceType: config.emailServiceType as EmailServiceType,
  emailConfig: config.email,
  serviceConfig:
    config.emailServiceType === EmailServiceType.SMTP ? config.smtp : undefined,
});
