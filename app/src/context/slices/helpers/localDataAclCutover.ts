/**
 * Open (or rebuild) a local project data DB for couch-auth-proxy cutover.
 */

import {PouchDBWrapper} from './pouchDBWrapper';
import {
  LOCAL_DATA_ACL_SCHEMA_DOC_ID,
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  LocalAclSchemaDoc,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';

export {
  LOCAL_DATA_ACL_SCHEMA_DOC_ID,
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';
export type {LocalAclSchemaDoc} from './localDataAclCutoverPolicy';

/**
 * Open (or rebuild) a local project data DB so pre-proxy leaked docs cannot
 * linger after ACL cutover.
 */
export async function openLocalDataDbWithAclCutover<Content extends {}>({
  id,
  createDb = (dbId: string) => new PouchDBWrapper<Content>(dbId),
}: {
  id: string;
  createDb?: (id: string) => PouchDBWrapper<Content>;
}): Promise<{db: PouchDBWrapper<Content>; rebuilt: boolean}> {
  let db = createDb(id);
  let rebuilt = false;

  let markerVersion: number | undefined;
  try {
    const marker = await db.get<LocalAclSchemaDoc>(
      LOCAL_DATA_ACL_SCHEMA_DOC_ID
    );
    markerVersion = marker.version;
  } catch {
    markerVersion = undefined;
  }

  const info = await db.info();
  const needsRebuild = shouldRebuildLocalDataDbForAclCutover({
    markerVersion,
    docCount: info.doc_count ?? 0,
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
      version: LOCAL_DATA_ACL_SCHEMA_VERSION,
    } as PouchDB.Core.PutDocument<Content & LocalAclSchemaDoc>);
  } catch {
    /* conflict after concurrent open is fine */
  }

  return {db, rebuilt};
}
