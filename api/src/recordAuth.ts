/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Record-level authorization helpers for the CRUD API.
 * Mirrors CouchDB validate_doc_update and app shouldDisplayRecord logic.
 */

import {
  canDeleteProjectRecord,
  canEditProjectRecord,
  canReadProjectRecord,
} from '@faims3/data-model';

function decodedTokenFromUser(user: globalThis.Express.User) {
  return {
    globalRoles: user.globalRoles,
    resourceRoles: user.resourceRoles,
  };
}

/**
 * Returns true if the user can read the record.
 * "My" record {@code created_by === user_id} requires READ_MY_PROJECT_RECORDS;
 * others require READ_ALL_PROJECT_RECORDS.
 */
export function canReadRecord({
  user,
  projectId,
  createdBy,
}: {
  user: globalThis.Express.User;
  projectId: string;
  createdBy: string;
}): boolean {
  return canReadProjectRecord({
    decodedToken: decodedTokenFromUser(user),
    projectId,
    recordCreatedBy: createdBy,
    actingUserId: user.user_id,
  });
}

/**
 * Returns true if the user can edit the record.
 * "My" record requires EDIT_MY_PROJECT_RECORDS; others require EDIT_ALL_PROJECT_RECORDS.
 */
export function canEditRecord({
  user,
  projectId,
  createdBy,
}: {
  user: globalThis.Express.User;
  projectId: string;
  createdBy: string;
}): boolean {
  return canEditProjectRecord({
    decodedToken: decodedTokenFromUser(user),
    projectId,
    recordCreatedBy: createdBy,
    actingUserId: user.user_id,
  });
}

/**
 * Returns true if the user can delete the record.
 * "My" record requires DELETE_MY_PROJECT_RECORDS; others require DELETE_ALL_PROJECT_RECORDS.
 */
export function canDeleteRecord({
  user,
  projectId,
  createdBy,
}: {
  user: globalThis.Express.User;
  projectId: string;
  createdBy: string;
}): boolean {
  return canDeleteProjectRecord({
    decodedToken: decodedTokenFromUser(user),
    projectId,
    recordCreatedBy: createdBy,
    actingUserId: user.user_id,
  });
}
