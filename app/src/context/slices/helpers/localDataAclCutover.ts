/**
 * Open (or rebuild) a local project data DB for couch-auth-proxy cutover.
 */

import {PouchDBWrapper} from './pouchDBWrapper';
import {
  effectiveAclClientSchemaVersion,
  LOCAL_DATA_ACL_SCHEMA_DOC_ID,
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  LocalAclSchemaDoc,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';

export {
  effectiveAclClientSchemaVersion,
  LOCAL_DATA_ACL_SCHEMA_DOC_ID,
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';
export type {LocalAclSchemaDoc} from './localDataAclCutoverPolicy';

/**
 * Open (or rebuild) a local project data DB so pre-proxy leaked docs cannot
 * linger after ACL cutover.
 *
 * Pass {@link remoteBaseUrl} (Conductor's advertised `dataDb.base_url`) so a
 * marker sealed while public URL still pointed at open Couch is invalidated
 * when the URL flips to couch-auth-proxy. Pass {@link aclClientSchemaVersion}
 * (Conductor's `dataDb.acl_client_schema_version`) so same-hostname AWS
 * cutovers can force a wipe by bumping the server generation.
 */
export async function openLocalDataDbWithAclCutover<Content extends {}>({
  id,
  remoteBaseUrl,
  aclClientSchemaVersion,
  createDb = (dbId: string) => new PouchDBWrapper<Content>(dbId),
}: {
  id: string;
  /** Public Couch/proxy base URL currently advertised for this project. */
  remoteBaseUrl?: string;
  /** Conductor-advertised ACL client schema generation (optional). */
  aclClientSchemaVersion?: number;
  createDb?: (id: string) => PouchDBWrapper<Content>;
}): Promise<{db: PouchDBWrapper<Content>; rebuilt: boolean}> {
  let db = createDb(id);
  let rebuilt = false;
  const sealVersion = effectiveAclClientSchemaVersion(aclClientSchemaVersion);

  let marker: LocalAclSchemaDoc | undefined;
  try {
    marker = await db.get<LocalAclSchemaDoc>(LOCAL_DATA_ACL_SCHEMA_DOC_ID);
  } catch {
    marker = undefined;
  }

  const info = await db.info();
  const needsRebuild = shouldRebuildLocalDataDbForAclCutover({
    markerVersion: marker?.version,
    markerRemoteBaseUrl: marker?.remoteBaseUrl,
    docCount: info.doc_count ?? 0,
    serverAdvertisedVersion: aclClientSchemaVersion,
    currentRemoteBaseUrl: remoteBaseUrl,
  });

  if (needsRebuild) {
    try {
      await db.destroy();
    } catch {
      /* ignore destroy races */
    }
    db = createDb(id);
    rebuilt = true;
  }

  try {
    const existing = await db
      .get<LocalAclSchemaDoc>(LOCAL_DATA_ACL_SCHEMA_DOC_ID)
      .catch(() => undefined);
    await db.put({
      _id: LOCAL_DATA_ACL_SCHEMA_DOC_ID,
      ...(existing?._rev ? {_rev: existing._rev} : {}),
      version: sealVersion,
      ...(remoteBaseUrl ? {remoteBaseUrl} : {}),
    } as PouchDB.Core.PutDocument<Content & LocalAclSchemaDoc>);
  } catch {
    /* conflict after concurrent open is fine */
  }

  return {db, rebuilt};
}
