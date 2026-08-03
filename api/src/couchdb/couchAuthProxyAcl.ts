/**
 * Conductor-side helpers for the couch-auth-proxy / FAIMS ACL ownership split.
 *
 * - Proxy installs/migrates `_design/acl` map + protocol validate_doc_update
 *   (`ACL_AUTO_INSTALL`) when it first sees a matching DB.
 * - Conductor **warms** the proxy (see below) so that ddoc exists, then patches
 *   project `dbacl`.
 *
 * Gated by `config.couchAuthProxyEnabled` (`COUCH_AUTH_PROXY_ENABLED`). When
 * false, warm is skipped (no HTTP to a non-existent proxy) but FAIMS still
 * stamps `creator`/`parent`, runs DATA migrations, and may patch `dbacl` if
 * `_design/acl` already exists (`missing_proxy_ddoc` is OK).
 *
 * ## What “warm” means
 *
 * Couch-auth-proxy installs `_design/acl` lazily on ACL-scoped access through
 * the proxy — not when Conductor talks to Couch on `COUCHDB_INTERNAL_URL`
 * (admin bypass). **Warming** is pinging the data DB via
 * `COUCHDB_PUBLIC_URL` (admin `GET /{db}`) so the proxy’s `ensureDb` →
 * `ensureAclDdoc` path runs and installs/migrates `_design/acl` if needed.
 *
 * Without that ping (or boot preload / a later client sync through the proxy),
 * FAIMS must not invent a vendored map; `ensureDataDbAclOverlay` returns
 * `missing_proxy_ddoc`. See AclValidationLayering.md and
 * CouchAuthProxyAclInstallBrief.md.
 */

import {
  DATA_DB_NAME_PREFIX,
  ensureDataDbAclOverlay,
  EnsureDataDbAclOverlayResult,
} from '@faims3/data-model';
import {config} from '../buildconfig';

export class ProxyAclDesignDocMissingError extends Error {
  constructor(dbName: string) {
    super(
      `Proxy-managed _design/acl is missing on ${dbName}. ` +
        `Warm couch-auth-proxy first: GET the DB via COUCHDB_PUBLIC_URL so ` +
        `ACL_AUTO_INSTALL can create _design/acl before patching dbacl.`
    );
    this.name = 'ProxyAclDesignDocMissingError';
  }
}

/**
 * Warm the proxy for a data DB: ping it through `COUCHDB_PUBLIC_URL` as Couch
 * admin so couch-auth-proxy runs `ensureDb` → `ensureAclDdoc` and installs
 * `_design/acl` when `ACL_AUTO_INSTALL` is on.
 *
 * This is a deliberate side-effect of an otherwise ordinary DB GET. Conductor
 * normally uses `COUCHDB_INTERNAL_URL`, which bypasses the proxy and therefore
 * never triggers auto-install — so new/idle `data-*` DBs need this warm (or
 * proxy boot preload / first client sync via the public URL) before FAIMS can
 * patch `dbacl`.
 *
 * No-ops when `COUCH_AUTH_PROXY_ENABLED` is false, or when public URL equals
 * internal URL (proxy not in the path) — callers then rely on an
 * already-present ddoc or accept `missing_proxy_ddoc`.
 */
export async function warmCouchAuthProxyAclDesignDoc(
  dbName: string
): Promise<void> {
  if (!config.couchAuthProxyEnabled) {
    return;
  }

  const publicUrl = config.couchdbPublicUrl.replace(/\/$/, '');
  const internalUrl = config.couchdbInternalUrl.replace(/\/$/, '');
  if (publicUrl === internalUrl) {
    return;
  }

  const {username, password} = config.localCouchdbAuth;
  const auth =
    'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const url = `${publicUrl}/${encodeURIComponent(dbName)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {Authorization: auth, Accept: 'application/json'},
  });

  // 200 = DB ready (ensureAclDdoc ran). 404 = DB missing. 503 = ACL cache
  // still loading — retry once.
  if (res.status === 404) {
    throw new Error(
      `warmCouchAuthProxyAclDesignDoc: database ${dbName} not found via proxy (${res.status})`
    );
  }
  if (res.status === 503) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const retry = await fetch(url, {
      method: 'GET',
      headers: {Authorization: auth, Accept: 'application/json'},
    });
    if (!retry.ok) {
      throw new Error(
        `warmCouchAuthProxyAclDesignDoc: proxy GET ${dbName} still not ready (${retry.status})`
      );
    }
    return;
  }
  if (!res.ok) {
    throw new Error(
      `warmCouchAuthProxyAclDesignDoc: proxy GET ${dbName} failed (${res.status})`
    );
  }
}

/**
 * Ensure proxy `_design/acl` exists (warm via public URL if needed), then patch
 * FAIMS `dbacl` and ensure `_design/faims_acl_shape`.
 *
 * Warm = ping `{COUCHDB_PUBLIC_URL}/{data-db}` so couch-auth-proxy installs
 * the ACL design doc before we overlay project role lists. Skipped when
 * `COUCH_AUTH_PROXY_ENABLED` is false.
 *
 * When the proxy is disabled, `requireProxyDdoc` defaults to false so ops can
 * still ensure `_design/faims_acl_shape` / patch `dbacl` if present without
 * failing on a missing proxy-owned ddoc.
 */
export async function ensureProjectDataDbAcl({
  projectId,
  db,
  requireProxyDdoc,
}: {
  projectId: string;
  db: {
    get: (id: string) => Promise<Record<string, unknown>>;
    put: (doc: Record<string, unknown>) => Promise<unknown>;
  };
  /** When true, fail if `_design/acl` is still missing after warm. */
  requireProxyDdoc?: boolean;
}): Promise<EnsureDataDbAclOverlayResult> {
  const dbName = `${DATA_DB_NAME_PREFIX}${projectId}`;
  const mustHaveProxyDdoc = requireProxyDdoc ?? config.couchAuthProxyEnabled;
  await warmCouchAuthProxyAclDesignDoc(dbName);
  const result = await ensureDataDbAclOverlay({db, projectId});
  if (mustHaveProxyDdoc && result.status === 'missing_proxy_ddoc') {
    throw new ProxyAclDesignDocMissingError(dbName);
  }
  return result;
}
