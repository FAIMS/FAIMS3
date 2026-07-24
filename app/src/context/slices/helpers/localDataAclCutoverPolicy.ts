/**
 * Policy for client-side ACL cutover hygiene (pure; no Pouch imports).
 *
 * Pre-proxy sync could leave other users' docs in IndexedDB. After
 * couch-auth-proxy cutover, local DBs without a current schema marker are
 * destroyed and recreated so guests cannot keep leaked corpus offline.
 *
 * The marker also records the public Couch/proxy base URL that sealed the DB.
 * If Conductor later advertises a different `dataDb.base_url` (typical when
 * flipping `COUCHDB_PUBLIC_URL` from open Couch → proxy), the local DB is
 * wiped again so a marker written against open Couch cannot "seal in" a
 * leaked corpus.
 */

/**
 * Local marker id written after a data DB is known to be safe for
 * couch-auth-proxy cutover. Bump {@link LOCAL_DATA_ACL_SCHEMA_VERSION} when a
 * future cutover requires wiping client IndexedDB again regardless of URL.
 */
export const LOCAL_DATA_ACL_SCHEMA_DOC_ID = '_local/faims-acl-schema';
export const LOCAL_DATA_ACL_SCHEMA_VERSION = 1;

export type LocalAclSchemaDoc = {
  _id: string;
  _rev?: string;
  version: number;
  /** Public Couch/proxy base URL that sealed this local DB (no trailing slash). */
  remoteBaseUrl?: string;
};

/**
 * Pure decision helper: should the local DB be wiped before sync?
 */
export function shouldRebuildLocalDataDbForAclCutover(args: {
  markerVersion?: number;
  markerRemoteBaseUrl?: string;
  docCount: number;
  currentVersion?: number;
  /** Current Conductor-advertised public Couch/proxy URL for this project. */
  currentRemoteBaseUrl?: string;
}): boolean {
  const current = args.currentVersion ?? LOCAL_DATA_ACL_SCHEMA_VERSION;
  if (typeof args.markerVersion === 'number') {
    if (args.markerVersion < current) {
      return true;
    }
    // Sealed against a different public URL (open Couch → proxy flip), or an
    // older marker that never recorded a URL while we now know the remote.
    if (
      args.currentRemoteBaseUrl &&
      args.markerRemoteBaseUrl !== args.currentRemoteBaseUrl
    ) {
      return true;
    }
    return false;
  }
  // Missing marker on a non-empty DB ⇒ likely pre-ACL sync corpus.
  return args.docCount > 0;
}
