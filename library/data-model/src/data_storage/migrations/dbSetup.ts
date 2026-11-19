// SPDX-License-Identifier: Apache-2.0
/**
 * Per-database design-document and security-document versions, recorded in
 * the migrations DB as one `db-setup` document per database.
 *
 * Design and security are versioned separately. When applying:
 *
 * - recorded version **higher** than this build: skip (do not downgrade)
 * - recorded version **equal** and hash matches: skip (happy path)
 * - recorded version **equal** and hash differs: push this build (patch)
 * - recorded version **lower** or missing: push this build (upgrade)
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
import {DatabaseInterface} from '../../types';
import {
  createHash,
  type DesignDocument,
  type InitialisationContent,
  type SecurityDocument,
  writeInitialisationDocument,
} from '../utils';
import {stableCanonicalJson} from './canonicalJson';
import {DATABASE_TYPES} from './types';

/** `kind` of a per-database setup record in the migrations DB. */
export const DB_SETUP_DOC_KIND = 'db-setup';

/** Stand-in project id when hashing DATA setup independently of a live survey. */
export const DB_SETUP_FINGERPRINT_PROJECT_ID = '__fingerprint__';

/** Attempts (initial + retries) when the setup-record put loses a 409 race. */
export const DB_SETUP_WRITE_ATTEMPTS = 5;

export const DB_SETUP_TYPES = [...DATABASE_TYPES, 'MIGRATIONS'] as const;
export type DbSetupType = (typeof DB_SETUP_TYPES)[number];

export type DbSetupPart = 'design' | 'security';

export type SetupAction = 'ahead' | 'up_to_date' | 'patch' | 'upgrade';

export type DbSetupPartState = {
  version: number;
  hash: string;
  updatedAtMs: number;
};

export type DbSetupDoc = {
  _id: string;
  _rev?: string;
  kind: typeof DB_SETUP_DOC_KIND;
  dbType: DbSetupType;
  dbName: string;
  design?: DbSetupPartState;
  security?: DbSetupPartState;
  fingerprint?: string;
  apiVersion?: string;
  writerId?: string;
};

export type DbSetupVersions = {design: number; security: number};

/**
 * Per-type design and security versions this build writes. Bump the matching
 * number when changing that type's design or security documents (or keep it
 * and treat the change as a same-version patch).
 */
export const DB_SETUP_VERSIONS: Record<DbSetupType, DbSetupVersions> = {
  AUTH: {design: 1, security: 1},
  DATA: {design: 1, security: 1},
  DIRECTORY: {design: 1, security: 1},
  INVITES: {design: 1, security: 1},
  PEOPLE: {design: 1, security: 1},
  PROJECTS: {design: 1, security: 1},
  TEMPLATES: {design: 1, security: 1},
  TEAMS: {design: 1, security: 1},
  MAP_ASSETS: {design: 1, security: 1},
  TOMBSTONE: {design: 1, security: 1},
  MIGRATIONS: {design: 1, security: 1},
};

export type DbSetupStore = {
  get: (id: string) => Promise<unknown>;
  put: (doc: DbSetupDoc) => Promise<unknown>;
  remove?: (doc: {_id: string; _rev: string}) => Promise<unknown>;
};

export type DbSetupDiagnostics = {
  fingerprint?: string;
  apiVersion?: string;
  writerId?: string;
};

export type DbSetupEvent = {
  setupType: DbSetupType;
  dbName: string;
  part: DbSetupPart;
  action: SetupAction;
  recordedVersion?: number;
  recordedHash?: string;
  targetVersion: number;
  targetHash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pouchStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  return typeof error.status === 'number' ? error.status : undefined;
}

function pouchName(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  return typeof error.name === 'string' ? error.name : undefined;
}

function isNotFound(error: unknown): boolean {
  return pouchStatus(error) === 404 || pouchName(error) === 'not_found';
}

function isConflict(error: unknown): boolean {
  return pouchStatus(error) === 409 || pouchName(error) === 'conflict';
}

export function isDbSetupType(value: string): value is DbSetupType {
  return (DB_SETUP_TYPES as readonly string[]).includes(value);
}

export function dbSetupDocId(setupType: DbSetupType, dbName: string): string {
  return `db-setup::${setupType}::${dbName}`;
}

function isPartState(value: unknown): value is DbSetupPartState {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.version === 'number' &&
    typeof value.hash === 'string' &&
    typeof value.updatedAtMs === 'number'
  );
}

/** True for a `kind: 'db-setup'` document with the required identity fields. */
export function isDbSetupDoc(doc: unknown): doc is DbSetupDoc {
  if (!isRecord(doc)) {
    return false;
  }
  return (
    typeof doc._id === 'string' &&
    doc.kind === DB_SETUP_DOC_KIND &&
    typeof doc.dbType === 'string' &&
    isDbSetupType(doc.dbType) &&
    typeof doc.dbName === 'string' &&
    (doc.design === undefined || isPartState(doc.design)) &&
    (doc.security === undefined || isPartState(doc.security))
  );
}

/**
 * Init payload this build would write for `setupType`. DATA uses
 * {@link DB_SETUP_FINGERPRINT_PROJECT_ID} unless `projectId` is given.
 * Directory is returned without the conductor env default document.
 */
export function contentForSetupType(
  setupType: DbSetupType,
  options: {projectId?: string} = {}
): InitialisationContent {
  switch (setupType) {
    case 'AUTH':
      return initAuthDB({});
    case 'DATA':
      return initDataDB({
        projectId: options.projectId ?? DB_SETUP_FINGERPRINT_PROJECT_ID,
      });
    case 'DIRECTORY':
      return initDirectoryDB({});
    case 'INVITES':
      return initInvitesDB({});
    case 'PEOPLE':
      return initPeopleDB({});
    case 'PROJECTS':
      return initProjectsDB({});
    case 'TEMPLATES':
      return initTemplatesDB({});
    case 'TEAMS':
      return initTeamsDB({});
    case 'MAP_ASSETS':
      return initMapAssetsDB({});
    case 'TOMBSTONE':
      return initTombstoneDB({});
    case 'MIGRATIONS':
      return initMigrationsDB({});
    default: {
      const exhaustive: never = setupType;
      throw new Error(`Unknown setup type: ${String(exhaustive)}`);
    }
  }
}

function withoutRev<T extends {_rev?: string}>(doc: T): Omit<T, '_rev'> {
  const {_rev: _ignored, ...rest} = doc;
  return rest;
}

/** SHA-256 of design documents, sorted by `_id`, with `_rev` dropped. */
export async function hashDesignDocuments(
  docs: readonly DesignDocument[]
): Promise<string> {
  const canonical = [...docs]
    .map(doc => withoutRev(doc))
    .sort((a, b) => a._id.localeCompare(b._id));
  return createHash(stableCanonicalJson(canonical));
}

/** SHA-256 of a security document. */
export async function hashSecurityDocument(
  doc: SecurityDocument
): Promise<string> {
  return createHash(stableCanonicalJson(doc));
}

export function decideSetupAction({
  recorded,
  target,
}: {
  recorded?: {version: number; hash: string};
  target: {version: number; hash: string};
}): SetupAction {
  if (recorded === undefined) {
    return 'upgrade';
  }
  if (recorded.version > target.version) {
    return 'ahead';
  }
  if (recorded.version < target.version) {
    return 'upgrade';
  }
  return recorded.hash === target.hash ? 'up_to_date' : 'patch';
}

export async function readDbSetupDoc(
  store: DbSetupStore,
  setupType: DbSetupType,
  dbName: string
): Promise<DbSetupDoc | null> {
  try {
    const doc = await store.get(dbSetupDocId(setupType, dbName));
    return isDbSetupDoc(doc) ? doc : null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Drops the setup record for a deleted database. No-op if none exists.
 */
export async function unregisterDbSetupDoc({
  setupType,
  dbName,
  setupStore,
}: {
  setupType: DbSetupType;
  dbName: string;
  setupStore: DbSetupStore;
}): Promise<{removed: boolean}> {
  const existing = await readDbSetupDoc(setupStore, setupType, dbName);
  if (!existing?._rev || setupStore.remove === undefined) {
    if (!existing?._rev) {
      return {removed: false};
    }
    throw new Error('setupStore.remove is required to unregister a setup doc');
  }
  await setupStore.remove({_id: existing._id, _rev: existing._rev});
  return {removed: true};
}

function shouldPush(action: SetupAction): boolean {
  return action === 'upgrade' || action === 'patch';
}

function emitEvent(
  onEvent: ((event: DbSetupEvent) => void) | undefined,
  event: DbSetupEvent
): void {
  onEvent?.(event);
}

/**
 * Apply this build's design and security documents according to the recorded
 * setup versions, then update the `db-setup` record.
 *
 * The default document (when present) is unversioned and always uses
 * {@link writeInitialisationDocument} with `forceDefaultDoc`.
 */
export async function applyVersionedInitialisation({
  db,
  content,
  setupType,
  dbName,
  setupStore,
  applyPermissions = true,
  forceDefaultDoc = false,
  diagnostics,
  onEvent,
  now = Date.now,
  maxAttempts = DB_SETUP_WRITE_ATTEMPTS,
}: {
  db: DatabaseInterface;
  content: InitialisationContent;
  setupType: DbSetupType;
  dbName: string;
  setupStore: DbSetupStore;
  applyPermissions?: boolean;
  forceDefaultDoc?: boolean;
  diagnostics?: DbSetupDiagnostics;
  onEvent?: (event: DbSetupEvent) => void;
  now?: () => number;
  maxAttempts?: number;
}): Promise<{design: SetupAction; security?: SetupAction}> {
  const targets = DB_SETUP_VERSIONS[setupType];
  const designHash = await hashDesignDocuments(content.designDocuments);
  const securityHash = await hashSecurityDocument(content.securityDocument);
  const designTarget = {version: targets.design, hash: designHash};
  const securityTarget = {version: targets.security, hash: securityHash};

  let designAction: SetupAction = 'upgrade';
  let securityAction: SetupAction | undefined = applyPermissions
    ? 'upgrade'
    : undefined;

  for (let attempt = 1; ; attempt += 1) {
    const existing = await readDbSetupDoc(setupStore, setupType, dbName);
    designAction = decideSetupAction({
      recorded: existing?.design,
      target: designTarget,
    });
    securityAction = applyPermissions
      ? decideSetupAction({
          recorded: existing?.security,
          target: securityTarget,
        })
      : undefined;

    const report = () => {
      emitEvent(onEvent, {
        setupType,
        dbName,
        part: 'design',
        action: designAction,
        recordedVersion: existing?.design?.version,
        recordedHash: existing?.design?.hash,
        targetVersion: designTarget.version,
        targetHash: designTarget.hash,
      });
      if (securityAction !== undefined) {
        emitEvent(onEvent, {
          setupType,
          dbName,
          part: 'security',
          action: securityAction,
          recordedVersion: existing?.security?.version,
          recordedHash: existing?.security?.hash,
          targetVersion: securityTarget.version,
          targetHash: securityTarget.hash,
        });
      }
    };

    if (shouldPush(designAction)) {
      for (const designDoc of content.designDocuments) {
        await writeInitialisationDocument({
          db,
          data: designDoc,
          forceWrite: true,
        });
      }
    }

    if (securityAction !== undefined && shouldPush(securityAction)) {
      await db.security(content.securityDocument).save();
    }

    if (content.defaultDocument) {
      await writeInitialisationDocument({
        db,
        data: content.defaultDocument,
        forceWrite: forceDefaultDoc,
      });
    }

    const designNeedsRecord = shouldPush(designAction);
    const securityNeedsRecord =
      securityAction !== undefined && shouldPush(securityAction);
    if (!designNeedsRecord && !securityNeedsRecord) {
      report();
      return {design: designAction, security: securityAction};
    }

    const updatedAtMs = now();
    const next: DbSetupDoc = {
      _id: dbSetupDocId(setupType, dbName),
      ...(existing?._rev !== undefined ? {_rev: existing._rev} : {}),
      kind: DB_SETUP_DOC_KIND,
      dbType: setupType,
      dbName,
      design: designNeedsRecord
        ? {version: designTarget.version, hash: designTarget.hash, updatedAtMs}
        : existing?.design,
      security: securityNeedsRecord
        ? {
            version: securityTarget.version,
            hash: securityTarget.hash,
            updatedAtMs,
          }
        : existing?.security,
      ...(diagnostics?.fingerprint !== undefined
        ? {fingerprint: diagnostics.fingerprint}
        : {}),
      ...(diagnostics?.apiVersion !== undefined
        ? {apiVersion: diagnostics.apiVersion}
        : {}),
      ...(diagnostics?.writerId !== undefined
        ? {writerId: diagnostics.writerId}
        : {}),
    };

    try {
      await setupStore.put(next);
      report();
      return {design: designAction, security: securityAction};
    } catch (error) {
      if (isConflict(error) && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
}
