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
