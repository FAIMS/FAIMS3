import {data_dbs} from './databases';

const syncingProjectListeners: (
  | [string, (syncing: boolean) => unknown]
  | undefined
)[] = [];

export function listenSyncingProject(
  active_id: string,
  callback: (syncing: boolean) => unknown
): () => void {
  const my_index = syncingProjectListeners.length;
  syncingProjectListeners.push([active_id, callback]);
  return () => {
    syncingProjectListeners[my_index] = undefined; // To disable this listener, set to undefined
  };
}

export function isSyncingProject(active_id: string) {
  if (data_dbs[active_id] === undefined) {
    throw 'Projects not initialized yet';
  }

  if (data_dbs[active_id].remote === null) {
    throw 'Projects not yet syncing';
  }

  return data_dbs[active_id].is_sync;
}

export function setSyncingProject(active_id: string, syncing: boolean) {
  if (syncing === isSyncingProject(active_id)) {
    return; //Nothing to do, already same value
  }
  data_dbs[active_id].is_sync = syncing;

  if (data_dbs[active_id].remote === null) {
    return;
  }

  if (syncing) {
    data_dbs[active_id].remote!.connection = PouchDB.replicate(
      data_dbs[active_id].remote!.db,
      data_dbs[active_id].local
    );
  } else {
    data_dbs[active_id].remote!.connection.cancel();
  }
  // Trigger sync listeners
  syncingProjectListeners
    .filter(l => l !== undefined && l![0] === active_id)
    .forEach(l => l![1](syncing));
}
