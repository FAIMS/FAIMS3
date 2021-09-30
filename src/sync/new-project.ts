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
 * Filename: new-project.ts
 * Description:
 *   TODO
 */
import {v4 as uuidv4} from 'uuid';

import {
  ListingsObject,
  LOCALLY_CREATED_PROJECT_PREFIX,
} from '../datamodel/database';
import {ProjectID, NonUniqueProjectID} from '../datamodel/core';

import {
  active_db,
  data_dbs,
  directory_db,
  ensure_local_db,
  metadata_dbs,
  projects_dbs,
} from './databases';
import {events} from './events';
import {activate_project} from './process-initialization';
import {createdProjects} from './state';

export async function request_allocation_for_project(project_id: ProjectID) {
  throw Error('not implemented yet');
}

/*
 * This creates the project databases which are needed locally. This does not
 * set up the remote databases, that will be the responsibility of other
 * systems.
 *
 * The process is:
 * 1. Create a listing for local-only projects (if it doesn't exist).
 * 2. Create the projects_db for that new listing (if it doesn't exist).
 * 3. Generate a new NonUniqueProjectID (uuidv4)
 * 4. Activate the project (to check for local duplicates)
 * 5. Create new meta/data db
 * 6. Return new project id (for further usage)
 */
export async function create_new_project_dbs(name: string): Promise<ProjectID> {
  const listing = await ensure_locally_created_project_listing();
  const projects_db = ensure_locally_created_projects_db(listing._id);
  const new_project_id = generate_non_unique_project_id();
  const active_id = await activate_project(
    listing._id,
    new_project_id,
    null,
    null,
    false
  );
  const active_project = await active_db.get(active_id);

  const project_object = {
    _id: active_id,
    name: name,
    status: 'new', // TODO: work out proper status
  };
  await projects_db.local.put(project_object);

  const [, meta_db_local] = ensure_local_db(
    'metadata',
    active_id,
    active_project.is_sync,
    metadata_dbs
  );
  const [, data_db_local] = ensure_local_db(
    'data',
    active_id,
    active_project.is_sync,
    data_dbs
  );

  createdProjects[active_id] = {
    project: project_object,
    active: active_project,
    meta: meta_db_local,
    data: data_db_local,
  };

  events.emit(
    'project_local',
    listing,
    active_project,
    project_object,
    meta_db_local,
    data_db_local
  );
  return active_id;
}

function generate_non_unique_project_id(): NonUniqueProjectID {
  return uuidv4();
}

async function ensure_locally_created_project_listing(): Promise<ListingsObject> {
  try {
    return await directory_db.local.get(LOCALLY_CREATED_PROJECT_PREFIX);
  } catch (err: any) {
    if (err.status === 404) {
      const listing_object = {
        _id: LOCALLY_CREATED_PROJECT_PREFIX,
        name: 'Locally Created Projects',
        description:
          'Projects created on this device (have not been submitted).',
      };
      await directory_db.local.put(listing_object as ListingsObject);
      return listing_object as ListingsObject;
    } else {
      throw err;
    }
  }
}

function ensure_locally_created_projects_db(projects_db_id: string) {
  const [, local_projects_db] = ensure_local_db(
    'projects',
    projects_db_id,
    true,
    projects_dbs
  );
  return local_projects_db;
}
