// SPDX-License-Identifier: Apache-2.0
/**
 * Process-constant fingerprint of the intended boot-migrate *end state*
 * known to this data-model build.
 *
 * Hashed inputs (stable order):
 * - each {@link DB_TARGET_VERSIONS} `targetVersion`
 * - {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}
 * - each `init*DB` couchInitialiser payload (data DBs use
 *   {@link STARTUP_MIGRATION_FINGERPRINT_PROJECT_ID}; directory is hashed
 *   without the conductor env default document)
 * - each database type's design/security setup versions and hashes
 *
 * Not hashed: live DB versions, pending diffs, registry `{from,to}` rows,
 * `defaultVersion`, `apiVersion` / package version, or JWT material (the API
 * folds the public key on top of this digest).
 *
 * SHA-256, first {@link STARTUP_MIGRATION_FINGERPRINT_LENGTH} lowercase hex
 * characters. Tests should clone {@link buildStartupMigrationFingerprintInput}
 * rather than mutating live registries.
 */
import {createHash, type InitialisationContent} from '../utils';
import {stableCanonicalJson} from './canonicalJson';
import {
  contentForSetupType,
  DB_SETUP_FINGERPRINT_PROJECT_ID,
  DB_SETUP_TYPES,
  DB_SETUP_VERSIONS,
  hashDesignDocuments,
  hashSecurityDocument,
  type DbSetupType,
} from './dbSetup';
import {DB_TARGET_VERSIONS} from './migrations';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from './notebookMigrations/registry';
import {DATABASE_TYPES, type DATABASE_TYPE} from './types';

/** Truncated SHA-256 stored on the startup-migration lock. */
export const STARTUP_MIGRATION_FINGERPRINT_LENGTH = 12;

/**
 * Stand-in project id when hashing {@link initDataDB}. Permissions and
 * security documents are project-scoped; a placeholder keeps the digest
 * independent of any live survey.
 */
export const STARTUP_MIGRATION_FINGERPRINT_PROJECT_ID =
  DB_SETUP_FINGERPRINT_PROJECT_ID;

/** One DB's intended schema target, hashed in {@link DATABASE_TYPES} order. */
export type StartupMigrationTargetVersionEntry = {
  dbType: DATABASE_TYPE;
  targetVersion: number;
};

/** One `init*DB` payload included in the fingerprint. */
export type StartupMigrationInitPayloadEntry = {
  name: string;
  content: InitialisationContent;
};

/** One database type's intended design/security setup, hashed in type order. */
export type StartupMigrationSetupTargetEntry = {
  type: DbSetupType;
  designVersion: number;
  designHash: string;
  securityVersion: number;
  securityHash: string;
};

/**
 * Canonical, JSON-serialisable input to
 * {@link hashStartupMigrationFingerprintInput}. Clone and tweak this in tests.
 */
export type StartupMigrationFingerprintInput = {
  targetVersions: StartupMigrationTargetVersionEntry[];
  notebookUiSchemaVersion: string;
  initPayloads: StartupMigrationInitPayloadEntry[];
  setupTargets: StartupMigrationSetupTargetEntry[];
};

async function setupTargetForType(
  type: DbSetupType
): Promise<StartupMigrationSetupTargetEntry> {
  const content = contentForSetupType(type);
  const versions = DB_SETUP_VERSIONS[type];
  return {
    type,
    designVersion: versions.design,
    designHash: await hashDesignDocuments(content.designDocuments),
    securityVersion: versions.security,
    securityHash: await hashSecurityDocument(content.securityDocument),
  };
}

/**
 * Snapshot of this build's intended boot end-state. Does not read Couch or
 * environment (directory `defaultConfig` is omitted on purpose).
 */
export async function buildStartupMigrationFingerprintInput(): Promise<StartupMigrationFingerprintInput> {
  const initPayloads = DB_SETUP_TYPES.map(type => ({
    name: type,
    content: contentForSetupType(type),
  }));
  return {
    targetVersions: DATABASE_TYPES.map(dbType => ({
      dbType,
      targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
    })),
    notebookUiSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    initPayloads,
    setupTargets: await Promise.all(DB_SETUP_TYPES.map(setupTargetForType)),
  };
}

/**
 * SHA-256 of `input`, truncated to
 * {@link STARTUP_MIGRATION_FINGERPRINT_LENGTH} lowercase hex characters.
 */
export async function hashStartupMigrationFingerprintInput(
  input: StartupMigrationFingerprintInput
): Promise<string> {
  const digest = await createHash(
    stableCanonicalJson({
      targetVersions: input.targetVersions,
      notebookUiSchemaVersion: input.notebookUiSchemaVersion,
      initPayloads: input.initPayloads,
      setupTargets: input.setupTargets,
    })
  );
  return digest.slice(0, STARTUP_MIGRATION_FINGERPRINT_LENGTH);
}

/**
 * Fingerprint of this process's data-model boot end-state. Does not include
 * `apiVersion` or JWT material.
 */
export async function startupMigrationFingerprint(): Promise<string> {
  return hashStartupMigrationFingerprintInput(
    await buildStartupMigrationFingerprintInput()
  );
}
