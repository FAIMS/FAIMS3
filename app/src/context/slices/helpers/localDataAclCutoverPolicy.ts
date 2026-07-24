/**
 * Policy for client-side ACL cutover hygiene (pure; no Pouch imports).
 *
 * Pre-proxy sync could leave other users' docs in IndexedDB. After
 * couch-auth-proxy cutover, local DBs without a current schema marker are
 * destroyed and recreated so guests cannot keep leaked corpus offline.
 */

/**
 * Local marker id written after a data DB is known to be safe for
 * couch-auth-proxy cutover. Bump {@link LOCAL_DATA_ACL_SCHEMA_VERSION} when a
 * future cutover requires wiping client IndexedDB again.
 */
export const LOCAL_DATA_ACL_SCHEMA_DOC_ID = '_local/faims-acl-schema';
export const LOCAL_DATA_ACL_SCHEMA_VERSION = 1;

export type LocalAclSchemaDoc = {
  _id: string;
  _rev?: string;
  version: number;
};

/**
 * Pure decision helper: should the local DB be wiped before sync?
 */
export function shouldRebuildLocalDataDbForAclCutover(args: {
  markerVersion?: number;
  docCount: number;
  currentVersion?: number;
}): boolean {
  const current = args.currentVersion ?? LOCAL_DATA_ACL_SCHEMA_VERSION;
  if (typeof args.markerVersion === 'number') {
    return args.markerVersion < current;
  }
  // Missing marker on a non-empty DB ⇒ likely pre-ACL sync corpus.
  return args.docCount > 0;
}
