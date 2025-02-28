/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: index.ts
 * Description:
 *   Main entry point for the module.
 */

import {
  generateFAIMSDataID,
  getFirstRecordHead,
  getFullRecordData,
  getHRIDforRecordID,
  getMetadataForAllRecords,
  getMetadataForSomeRecords,
  getPossibleRelatedRecords,
  getRecordMetadata,
  getRecordsWithRegex,
  getRecordType,
  listFAIMSRecordRevisions,
  notebookRecordIterator,
  setRecordAsDeleted,
  upsertFAIMSData,
} from './data_storage';
import {
  attachment_to_file,
  attachments_to_files,
  file_attachments_to_data,
  file_data_to_attachments,
  files_to_attachments,
} from './data_storage/attachments';
import {addDesignDocsForNotebook} from './data_storage/databases';
import {
  findConflictingFields,
  getInitialMergeDetails,
  getMergeInformationForHead,
  mergeHeads,
  saveUserMergeResult,
} from './data_storage/merging';
import {getAllRecordsWithRegex} from './data_storage/queries';
import {DEFAULT_RELATION_LINK_VOCABULARY, HRID_STRING} from './datamodel/core';
import {
  getEqualityFunctionForType,
  isEqualFAIMS,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
  setEqualityFunctionForType,
} from './datamodel/typesystem';
import {logError} from './logging';
import {ProjectID, RecordMetadata, TokenContents} from './types';
export * from './auth';
export * from './data_storage/authDB';
export * from './utils';

export {
  addDesignDocsForNotebook,
  attachment_to_file,
  attachments_to_files,
  DEFAULT_RELATION_LINK_VOCABULARY,
  file_attachments_to_data,
  file_data_to_attachments,
  files_to_attachments,
  findConflictingFields,
  generateFAIMSDataID,
  getAllRecordsWithRegex,
  getEqualityFunctionForType,
  getFirstRecordHead,
  getFullRecordData,
  getHRIDforRecordID,
  getInitialMergeDetails,
  getMergeInformationForHead,
  getMetadataForAllRecords,
  getMetadataForSomeRecords,
  getPossibleRelatedRecords,
  getRecordMetadata,
  getRecordsWithRegex,
  getRecordType,
  HRID_STRING,
  isEqualFAIMS,
  listFAIMSRecordRevisions,
  mergeHeads,
  notebookRecordIterator,
  saveUserMergeResult,
  setAttachmentDumperForType,
  setAttachmentLoaderForType,
  setEqualityFunctionForType,
  setRecordAsDeleted,
  upsertFAIMSData,
};

export * from './api';
export * from './datamodel/database';
export * from './types';

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
