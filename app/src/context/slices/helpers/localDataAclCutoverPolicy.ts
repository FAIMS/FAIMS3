/**
 * Policy for client-side ACL cutover hygiene (pure; no Pouch imports).
 *
 * Pre-proxy sync could leave other users' docs in IndexedDB. After
 * couch-auth-proxy cutover, local DBs without a current schema marker are
 * destroyed and recreated so guests cannot keep leaked corpus offline.
 *
 * Rebuild triggers:
 * 1. Marker version behind `max(LOCAL_DATA_ACL_SCHEMA_VERSION, serverAdvertised)`
 * 2. Marker sealed against a different public base URL (local `:5984`→`:5985`)
 * 3. Missing marker on a non-empty DB
 *
 * AWS keeps the public hostname stable when ALB flips Couch → proxy, so URL
 * mismatch alone is not enough. Operators bump Conductor's
 * `COUCH_ACL_CLIENT_SCHEMA_VERSION` at flip time; apps compare that advertised
 * generation against the local marker.
 */

/**
 * Local marker id written after a data DB is known to be safe for
 * couch-auth-proxy cutover. Bump {@link LOCAL_DATA_ACL_SCHEMA_VERSION} when an
 * app release must wipe client IndexedDB again regardless of URL / server
 * generation (e.g. one-time hygiene for pre-proxy corpora).
 */
export const LOCAL_DATA_ACL_SCHEMA_DOC_ID = '_local/faims-acl-schema';
/**
 * App-bundled minimum schema generation. Raised to 2 so clients that sealed a
 * v1 marker against open Couch (including same-hostname AWS) rebuild once on
 * upgrade. Future same-hostname flips without an app release should bump
 * Conductor `COUCH_ACL_CLIENT_SCHEMA_VERSION` instead.
 */
export const LOCAL_DATA_ACL_SCHEMA_VERSION = 2;

export type LocalAclSchemaDoc = {
  _id: string;
  _rev?: string;
  version: number;
  /** Public Couch/proxy base URL that sealed this local DB (no trailing slash). */
  remoteBaseUrl?: string;
};

/**
 * Effective schema generation the local DB must meet.
 * Uses the higher of the app-bundled constant and Conductor's advertised value
 * so operators can force a wipe without shipping a new app build.
 */
export function effectiveAclClientSchemaVersion(
  serverAdvertisedVersion?: number
): number {
  if (
    typeof serverAdvertisedVersion === 'number' &&
    Number.isFinite(serverAdvertisedVersion) &&
    serverAdvertisedVersion > LOCAL_DATA_ACL_SCHEMA_VERSION
  ) {
    return Math.floor(serverAdvertisedVersion);
  }
  return LOCAL_DATA_ACL_SCHEMA_VERSION;
}

/**
 * Pure decision helper: should the local DB be wiped before sync?
 */
export function shouldRebuildLocalDataDbForAclCutover(args: {
  markerVersion?: number;
  markerRemoteBaseUrl?: string;
  docCount: number;
  currentVersion?: number;
  /** Conductor-advertised `dataDb.acl_client_schema_version` (optional). */
  serverAdvertisedVersion?: number;
  /** Current Conductor-advertised public Couch/proxy URL for this project. */
  currentRemoteBaseUrl?: string;
}): boolean {
  const current =
    args.currentVersion ??
    effectiveAclClientSchemaVersion(args.serverAdvertisedVersion);
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
