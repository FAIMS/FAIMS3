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
 *
 * Not hashed: live DB versions, pending diffs, registry `{from,to}` rows,
 * `defaultVersion`, `apiVersion` / package version, or JWT material (the API
 * folds the public key on top of this digest).
 *
 * SHA-256, first {@link STARTUP_MIGRATION_FINGERPRINT_LENGTH} lowercase hex
 * characters. Tests should clone {@link buildStartupMigrationFingerprintInput}
 * rather than mutating live registries.
 */
import {initAuthDB} from '../authDB/init';
import {initDataDB} from '../dataDB/init';
import {initDirectoryDB} from '../directoryDB/init';
import {initInvitesDB} from '../invitesDB/init';
import {initMapAssetsDB} from '../mapAssetsDB/init';
import {initMigrationsDB} from '../migrationsDB/init';
import {initPeopleDB} from '../peopleDB/init';
import {initProjectsDB} from '../projectsDB/init';
import {initTeamsDB} from '../teamsDB/init';
import {initTemplatesDB} from '../templatesDB/init';
import {initTombstoneDB} from '../tombstoneDB/init';
import {createHash, type InitialisationContent} from '../utils';
import {DB_TARGET_VERSIONS} from './migrations';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from './notebookMigrations/registry';
import {DATABASE_TYPES, DatabaseType, type DATABASE_TYPE} from './types';

/** Truncated SHA-256 stored on the startup-migration lock. */
export const STARTUP_MIGRATION_FINGERPRINT_LENGTH = 12;

/**
 * Stand-in project id when hashing {@link initDataDB}. Permissions and
 * security documents are project-scoped; a placeholder keeps the digest
 * independent of any live survey.
 */
export const STARTUP_MIGRATION_FINGERPRINT_PROJECT_ID = '__fingerprint__';

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

/**
 * Canonical, JSON-serialisable input to
 * {@link hashStartupMigrationFingerprintInput}. Clone and tweak this in tests.
 */
export type StartupMigrationFingerprintInput = {
  targetVersions: StartupMigrationTargetVersionEntry[];
  notebookUiSchemaVersion: string;
  initPayloads: StartupMigrationInitPayloadEntry[];
};

/**
 * Stable stringify so logically identical values hash identically regardless
 * of key insertion order. `undefined` fields are omitted.
 */
function stableCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableCanonicalJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableCanonicalJson(record[key])}`)
    .join(',')}}`;
}

/**
 * Snapshot of this build's intended boot end-state. Does not read Couch or
 * environment (directory `defaultConfig` is omitted on purpose).
 */
export function buildStartupMigrationFingerprintInput(): StartupMigrationFingerprintInput {
  return {
    targetVersions: DATABASE_TYPES.map(dbType => ({
      dbType,
      targetVersion: DB_TARGET_VERSIONS[dbType].targetVersion,
    })),
    notebookUiSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    initPayloads: [
      {name: DatabaseType.AUTH, content: initAuthDB({})},
      {
        name: DatabaseType.DATA,
        content: initDataDB({
          projectId: STARTUP_MIGRATION_FINGERPRINT_PROJECT_ID,
        }),
      },
      {name: DatabaseType.DIRECTORY, content: initDirectoryDB({})},
      {name: DatabaseType.INVITES, content: initInvitesDB({})},
      {name: DatabaseType.PEOPLE, content: initPeopleDB({})},
      {name: DatabaseType.PROJECTS, content: initProjectsDB({})},
      {name: DatabaseType.TEMPLATES, content: initTemplatesDB({})},
      {name: DatabaseType.TEAMS, content: initTeamsDB({})},
      {name: DatabaseType.MAP_ASSETS, content: initMapAssetsDB({})},
      {name: DatabaseType.TOMBSTONE, content: initTombstoneDB({})},
      {name: 'MIGRATIONS', content: initMigrationsDB({})},
    ],
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
    buildStartupMigrationFingerprintInput()
  );
}
