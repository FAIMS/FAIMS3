/**
 * Conductor-side helpers for the couch-auth-proxy / FAIMS ACL ownership split.
 *
 * - Proxy installs/migrates `_design/acl` map + protocol VDU (`ACL_AUTO_INSTALL`).
 * - Conductor warms the proxy so that ddoc exists, then patches project `dbacl`.
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
        `Warm couch-auth-proxy (ACL_AUTO_INSTALL) before patching dbacl.`
    );
    this.name = 'ProxyAclDesignDocMissingError';
  }
}

/**
 * Touch a data DB through `COUCHDB_PUBLIC_URL` (the proxy) as Couch admin so
 * `ensureDb` → `ensureAclDdoc` runs and auto-installs `_design/acl` when absent.
 *
 * No-ops when public URL equals internal URL (proxy not in path) — callers then
 * rely on an already-present ddoc or accept `missing_proxy_ddoc`.
 */
export async function warmCouchAuthProxyAclDesignDoc(
  dbName: string
): Promise<void> {
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
 * Warm the proxy ACL ddoc (if public ≠ internal), then patch FAIMS `dbacl` and
 * ensure `_design/faims_acl_shape`.
 */
export async function ensureProjectDataDbAcl({
  projectId,
  db,
  requireProxyDdoc = true,
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
  await warmCouchAuthProxyAclDesignDoc(dbName);
  const result = await ensureDataDbAclOverlay({db, projectId});
  if (requireProxyDdoc && result.status === 'missing_proxy_ddoc') {
    throw new ProxyAclDesignDocMissingError(dbName);
  }
  return result;
}
