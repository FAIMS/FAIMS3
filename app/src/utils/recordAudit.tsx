import {
  getRecordListAudit,
  PostRecordStatusResponse,
  ProjectID,
  queryCouch,
  RECORDS_INDEX,
} from '@faims3/data-model';
import {localGetDataDb} from '..';
import {getRecordAudit} from './apiOperations/notebooks';

export interface RecordStatus extends PostRecordStatusResponse {
  recordHashes: Record<string, string>;
}

/**
 * Validate the sync status of records in a project
 *
 * @param projectId - the project id to validate
 */
export const validateSyncStatus = async ({
  projectId,
  username,
  listingId,
  currentStatus,
}: {
  projectId: ProjectID;
  username: string | undefined;
  listingId: string;
  currentStatus: RecordStatus | undefined;
}): Promise<RecordStatus> => {
  // get the list of record ids from the project
  const dataDb = localGetDataDb(projectId);
  const isOnline = window.navigator.onLine;
  const emptyStatus = {
    status: {},
    recordHashes: {},
  };

  // we can't do an audit if we don't have a user
  if (!username) return emptyStatus;

  // get a list of record ids from the project
  const records = await queryCouch({
    db: dataDb,
    index: RECORDS_INDEX,
  });
  const recordIds = records.map(r => r._id);
  const audit = await getRecordListAudit({recordIds, dataDb});
  let filteredAudit: Record<string, string> = {};

  // now filter any records that we know are good from the last
  // audit
  if (currentStatus) {
    for (const recordId of recordIds) {
      // check the record if the hash has changed or the status was false last time
      if (
        audit[recordId] !== currentStatus.recordHashes[recordId] ||
        !currentStatus.status[recordId]
      ) {
        filteredAudit[recordId] = audit[recordId];
      }
    }
  } else {
    filteredAudit = audit;
  }

  // if we're online, do the request
  if (isOnline) {
    if (Object.getOwnPropertyNames(filteredAudit).length > 0) {
      const response = await getRecordAudit({
        projectId,
        listingId,
        username,
        audit: filteredAudit,
      });
      // we need to merge the returned value with the
      // current status
      const status = {
        ...currentStatus?.status,
        ...response.status,
      };
      return {
        status: status,
        recordHashes: audit,
      };
    } else if (currentStatus) {
      return currentStatus;
    } else {
      return emptyStatus;
    }
  } else {
    // not online
    if (currentStatus) {
      // take the current status and for any record that doesn't now
      // have the same hash, set the status to false
      const offlineStatus = Object.assign({}, currentStatus.status);
      for (const recordId of recordIds) {
        if (audit[recordId] !== currentStatus.recordHashes[recordId]) {
          offlineStatus[recordId] = false;
        }
      }
      return {
        status: offlineStatus,
        recordHashes: audit,
      };
    } else return emptyStatus;
  }
};
