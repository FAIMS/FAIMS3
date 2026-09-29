// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: database.ts
 * Description:
 *   TODO
 */

import {ProjectDataObject, EncodedRecord} from '../types';

export const UI_SPECIFICATION_NAME = 'ui-specification';
export const PROJECT_SPECIFICATION_PREFIX = 'project-specification';
export const PROJECT_METADATA_PREFIX = 'project-metadata';
export const RECORD_INDEX_NAME = 'record-version-index';
export const LOCALLY_CREATED_PROJECT_PREFIX = 'locallycreatedproject';

export function isRecord(doc: ProjectDataObject): doc is EncodedRecord {
  return (<EncodedRecord>doc).record_format_version !== undefined;
}
