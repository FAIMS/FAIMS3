/**
 * Node-side CouchDB helpers for e2e setup that the Conductor API will not
 * accept (e.g. stamping a notebook with a newer-than-current schemaVersion).
 *
 * Credentials default to the local-dev values in `api/.env.dist`. Override
 * with `COUCHDB_INTERNAL_URL` / `COUCHDB_USER` / `COUCHDB_PASSWORD`, or drop
 * those into `api/.env` (loaded here if present).
 */
import {config as loadDotenv} from 'dotenv';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadE2eEnv} from './env.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let couchEnvLoaded = false;

function loadCouchEnv(): void {
  if (couchEnvLoaded) return;
  loadE2eEnv();
  // Do not override values already in the process environment.
  for (const rel of ['../api/.env', '../.env']) {
    const path = resolve(e2eRoot, rel);
    if (existsSync(path)) {
      loadDotenv({path, override: false});
    }
  }
  couchEnvLoaded = true;
}

function couchConfig(): {baseUrl: string; user: string; password: string} {
  loadCouchEnv();
  const raw =
    process.env.COUCHDB_INTERNAL_URL ||
    process.env.COUCHDB_PUBLIC_URL ||
    'http://localhost:5984';
  return {
    baseUrl: raw.replace(/\/$/, ''),
    user: process.env.COUCHDB_USER || 'admin',
    password:
      process.env.COUCHDB_PASSWORD || 'aSecretPasswordThatCantBeGuessed',
  };
}

async function couchJson(
  path: string,
  init: RequestInit = {}
): Promise<{ok: boolean; status: number; body: unknown}> {
  const {baseUrl, user, password} = couchConfig();
  const auth = Buffer.from(`${user}:${password}`).toString('base64');
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return {ok: res.ok, status: res.status, body};
}

type ProjectDoc = {
  _id: string;
  _rev: string;
  uiSpecification?: {
    uiSpec?: {schemaVersion?: string; [key: string]: unknown};
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Seeded current-schema notebook used by the last-good e2e path. */
export const SEED_LAST_GOOD_NOTEBOOK_ID = 'notebook_seed_last_good';

/** Display name written by `seedTestDataset` for {@link SEED_LAST_GOOD_NOTEBOOK_ID}. */
export const SEED_LAST_GOOD_NOTEBOOK_NAME = 'Last Good Schema (current)';

async function getProjectDoc(notebookId: string): Promise<ProjectDoc> {
  const got = await couchJson(`/projects/${encodeURIComponent(notebookId)}`);
  if (!got.ok) {
    throw new Error(
      `GET /projects/${notebookId} failed (${got.status}): ${JSON.stringify(got.body)}`
    );
  }
  return got.body as ProjectDoc;
}

/** Current `uiSpec.schemaVersion` on a project document in Couch. */
export async function readNotebookSchemaVersion(
  notebookId: string
): Promise<string> {
  const version = (await getProjectDoc(notebookId)).uiSpecification?.uiSpec
    ?.schemaVersion;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`Project ${notebookId} has no uiSpec.schemaVersion`);
  }
  return version;
}

/**
 * Overwrite `uiSpec.schemaVersion` on a project document in the `projects`
 * database. Returns the previous stamp.
 */
export async function stampNotebookSchemaVersion(
  notebookId: string,
  schemaVersion: string
): Promise<string> {
  const doc = await getProjectDoc(notebookId);
  const uiSpec = doc.uiSpecification?.uiSpec;
  if (!uiSpec) {
    throw new Error(
      `Project ${notebookId} has no uiSpecification.uiSpec to stamp`
    );
  }
  const previous =
    typeof uiSpec.schemaVersion === 'string' ? uiSpec.schemaVersion : '';
  uiSpec.schemaVersion = schemaVersion;
  const put = await couchJson(`/projects/${encodeURIComponent(notebookId)}`, {
    method: 'PUT',
    body: JSON.stringify(doc),
  });
  if (!put.ok) {
    throw new Error(
      `PUT /projects/${notebookId} failed (${put.status}): ${JSON.stringify(put.body)}`
    );
  }
  return previous;
}

/** Next major (`X+1.0.0`) of a strict `MAJOR.MINOR.PATCH` stamp. */
export function nextMajorSchemaVersion(current: string): string {
  const [major] = current.split('.').map(Number);
  if (!Number.isFinite(major)) {
    throw new Error(`Cannot bump schemaVersion '${current}'`);
  }
  return `${major + 1}.0.0`;
}
