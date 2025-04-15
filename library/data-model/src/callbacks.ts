import {logError} from './logging';
import {TokenContents} from './permission/types';
import {RecordMetadata, ProjectID} from './types';

export type DBCallbackObject = {
  getDataDB: (projectId: string) => Promise<any>;
  shouldDisplayRecord: (params: {
    contents: TokenContents;
    projectId: string;
    recordMetadata: RecordMetadata;
  }) => Promise<boolean>;
};

let moduleCallback: DBCallbackObject;

export const registerClient = (callbacks: DBCallbackObject) => {
  moduleCallback = callbacks;
};

export const getDataDB = (project_id: ProjectID) => {
  if (moduleCallback) {
    return moduleCallback.getDataDB(project_id);
  } else {
    logError('No callback registered to get data database');
    return undefined;
  }
};

export const shouldDisplayRecord = (
  contents: TokenContents,
  project_id: ProjectID,
  record_metadata: RecordMetadata
) => {
  if (moduleCallback) {
    return moduleCallback.shouldDisplayRecord({
      projectId: project_id,
      recordMetadata: record_metadata,
      contents,
    });
  } else {
    logError('No callback registered to check record permissions');
    return undefined;
  }
};
