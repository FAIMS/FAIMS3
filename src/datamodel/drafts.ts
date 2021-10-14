/*
 * Copyright 2021 Macquarie University
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
 * Filename: draft-storage.ts
 * Description:
 *   TODO
 */

import {ProjectID, RecordID, RevisionID} from './core';

export interface EncodedDraft {
  _id: string;
  // Fields (may itself contain an _id)
  fields: {[key: string]: unknown};
  project_id: ProjectID;
  // If this draft is for the user updating an existing record, the following
  // is non-null, the record it's editing.
  existing: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  };
  created: string;
  updated: string;
  type: string;
}

//to get the metadata for the draft, for draft_table
export interface DraftMetadata {
  _id: string;
  project_id: ProjectID;
  existing: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  };
  // Only difference: Date is a date, not string
  created: Date;
  updated: Date;
  type: string;
}

export type DraftMetadataList = {
  [key: string]: DraftMetadata;
};
