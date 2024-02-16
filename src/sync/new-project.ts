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
 * Filename: new-project.ts
 * Description:
 *   TODO
 */
import {v4 as uuidv4} from 'uuid';
import {ProjectID, NonUniqueProjectID} from 'faims3-datamodel';

import {
  directory_db,
  ensure_local_db,
  projects_dbs,
  ListingsObject,
} from './databases';
import {activate_project} from './process-initialization';
import {logError} from '../logging';

export const LOCALLY_CREATED_PROJECT_PREFIX = 'locallycreatedproject';

export async function request_allocation_for_project(project_id: ProjectID) {
  console.debug(`Requesting allocation for ${project_id}`);
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
  // Get the local-only listing
  console.debug('Creating new project', name);
  const listing = await ensure_locally_created_project_listing();
  console.debug('Checked locally created listing');
  const projects_db = ensure_locally_created_projects_db(listing._id);
  console.debug('Got locally created projects_db');

  // create the new project
  const new_project_id = generate_non_unique_project_id();
  const creation_time = new Date();
  const project_object = {
    _id: new_project_id,
    name: name,
    status: 'local_draft',
    created: creation_time.toISOString(),
    last_updated: creation_time.toISOString(),
  };
  await projects_db.local.put(project_object);
  console.debug('Created new project', new_project_id);

  const active_id = await activate_project(
    listing._id,
    new_project_id,
    null,
    null,
    false
  );
  console.debug('Activated new project', new_project_id);

  return active_id;
}

function generate_non_unique_project_id(): NonUniqueProjectID {
  return 'proj-' + uuidv4();
}

export async function ensure_locally_created_project_listing(): Promise<ListingsObject> {
  try {
    return await directory_db.local.get(LOCALLY_CREATED_PROJECT_PREFIX);
  } catch (err: any) {
    if (err.status === 404) {
      console.debug('Creating local-only listing');
      const listing_object = {
        _id: LOCALLY_CREATED_PROJECT_PREFIX,
        name: 'Locally Created Projects',
        description:
          'Projects created on this device (have not been submitted).',
        local_only: true,
        auth_mechanisms: {}, // No auth needed, nor allowed
      };
      try {
        await directory_db.local.put(listing_object);
        return listing_object;
      } catch (err: any) {
        // if we get here, then the document has been created by another
        // call to this function so let's just return this listing object
        return listing_object;
      }
    } else {
      logError('Failed to create locally created projects listing');
      throw err;
    }
  }
}

function ensure_locally_created_projects_db(projects_db_id: string) {
  const [, local_projects_db] = ensure_local_db(
    'projects',
    projects_db_id,
    true,
    projects_dbs,
    true
  );
  return local_projects_db;
}
