import {DataDocument, DataEngine} from '@faims3/data-model';
import type {DatabaseInterface, UISpecification} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';

export type SyncHandle = {
  stop: () => void;
};

export type DashboardProjectRuntime = {
  projectId: string;
  engine: DataEngine;
  localDb: DatabaseInterface<DataDocument>;
  syncHandle: SyncHandle;
};

export function createLocalDb(
  projectId: string
): DatabaseInterface<DataDocument> {
  // Use a deterministic local DB name per project
  const name = `dashboard_${projectId}_data`;
  return new PouchDB<DataDocument>(name);
}

export function createOneWaySync({
  couchUrl,
  databaseName,
  token,
  localDb,
}: {
  couchUrl: string;
  databaseName: string;
  token: string;
  localDb: DatabaseInterface<DataDocument>;
}): SyncHandle {
  const dbConnectionString = couchUrl.endsWith('/')
    ? couchUrl + databaseName
    : couchUrl + '/' + databaseName;

  const remote = new PouchDB<DataDocument>(dbConnectionString, {
    skip_setup: true,
    fetch: (url : string, opts: any) => {
      opts.headers.set('Authorization', `Bearer ${token}`);
      return PouchDB.fetch(url, opts);
    },
  });

  // One-way, live pull replication from remote → local
  const replication = PouchDB.replicate(
    remote,
    (localDb as any).db ?? localDb,
    {
      live: true,
      retry: true,
      attachments: true,
    }
  );

  return {
    stop: () => {
      replication.cancel();
      replication.removeAllListeners();
    },
  };
}

export function createDataEngine({
  localDb,
  uiSpec,
}: {
  localDb: DatabaseInterface<DataDocument>;
  uiSpec: UISpecification;
}) {
  return new DataEngine({
    dataDb: localDb,
    uiSpec,
  });
}
