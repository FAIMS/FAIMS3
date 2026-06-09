import {ProjectDataObject} from '@faims3/data-model';
import type {ReplicatingSyncMode} from '../../../sync/syncMode';
import {isReplicating} from '../../../sync/syncMode';
import {
  buildSyncId,
  createPouchDbReplication,
  SyncEventHandlers,
} from './databaseHelpers';
import {databaseService} from './databaseService';
import {PouchDBWrapper} from './pouchDBWrapper';

export interface RegisterReplicationParams {
  syncMode: ReplicatingSyncMode;
  attachmentDownload: boolean;
  localDb: PouchDBWrapper<ProjectDataObject>;
  remoteDb: PouchDB.Database<ProjectDataObject>;
  localDbId: string;
  remoteDbId: string;
  eventHandlers: SyncEventHandlers;
  oldSyncId?: string;
}

export interface RegisterReplicationResult {
  syncId: string | undefined;
}

/**
 * Tear down an existing replication handle (if any) and register a new one when
 * syncMode is not `none`.
 */
export async function replaceProjectReplication({
  syncMode,
  attachmentDownload,
  localDb,
  remoteDb,
  localDbId,
  remoteDbId,
  eventHandlers,
  oldSyncId,
}: RegisterReplicationParams): Promise<RegisterReplicationResult> {
  if (oldSyncId) {
    await databaseService.closeAndRemoveSync(oldSyncId);
  }

  if (!isReplicating(syncMode)) {
    return {syncId: undefined};
  }

  const replication = createPouchDbReplication({
    syncMode,
    attachmentDownload,
    localDb,
    remoteDb,
    eventHandlers,
  });

  const syncId = buildSyncId({
    localId: localDbId,
    remoteId: remoteDbId,
  });
  await databaseService.registerSync(syncId, replication);
  return {syncId};
}
