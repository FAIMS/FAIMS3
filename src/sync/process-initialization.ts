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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import {USE_REAL_DATA, AUTOACTIVATE_PROJECTS} from '../buildconfig';
import {
  ConnectionInfo,
  ProjectDataObject,
  ListingsObject,
  PeopleDoc,
  ProjectMetaObject,
  ProjectObject,
} from '../datamodel/database';
import {
  setupExampleDirectory,
  setupExampleListing,
  setupExampleProjectMetadata,
  setupExampleData,
} from '../dummyData';
import {
  ConnectionInfo_create_pouch,
  materializeConnectionInfo,
} from './connection';
import {
  directory_db,
  active_db,
  get_default_instance,
  ensure_local_db,
  people_dbs,
  projects_dbs,
  ensure_synced_db,
  ExistingActiveDoc,
  LocalDB,
  metadata_dbs,
  data_dbs,
  DEFAULT_LISTING_ID,
} from './databases';
import {events} from './events';
import {createdProjects} from './state';
import {setLocalConnection} from './databases';
import {SyncHandler} from './sync-handler';
import {NonUniqueProjectID, resolve_project_id} from '../datamodel/core';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';
const DIRECTORY_TIMEOUT = 2000;
const LISTINGS_TIMEOUT = 2000;
const PROJECT_TIMEOUT = 2000;

export async function process_directory(
  directory_connection_info: ConnectionInfo
) {
  // Only sync active listings:
  const get_active_listings_in_this_directory = async () => {
    const all_listing_ids_in_this_directory = (
      await directory_db.local.allDocs()
    ).rows.map(row => row.id);

    console.debug(
      `All the listing ids found are ${all_listing_ids_in_this_directory}`
    );

    const active_listings_in_this_directory = (
      await active_db.find({
        selector: {
          listing_id: {$in: all_listing_ids_in_this_directory},
        },
      })
    ).docs;

    console.debug(
      `The active listing ids are ${active_listings_in_this_directory}`
    );

    return new Set(
      active_listings_in_this_directory.map(doc => doc.listing_id)
    );
  };
  const unupdated_listings_in_this_directory = await get_active_listings_in_this_directory();

  events.emit('directory_local', unupdated_listings_in_this_directory);

  if (directory_db.remote !== null) {
    return; //Already hooked up
  }

  if (USE_REAL_DATA) {
    const directory_paused = ConnectionInfo_create_pouch<ListingsObject>(
      directory_connection_info
    );

    const sync_handler = () =>
      new SyncHandler<ListingsObject>(DIRECTORY_TIMEOUT, {
        active: async () =>
          events.emit(
            'directory_active',
            await get_active_listings_in_this_directory()
          ),
        paused: async changes => {
          events.emit(
            'directory_paused',
            await get_active_listings_in_this_directory(),
            changes
          );
        },
        error: async () => {
          if (!USE_REAL_DATA) await setupExampleDirectory(directory_db.local);
          events.emit(
            'directory_paused',
            await get_active_listings_in_this_directory(),
            []
          );
        },
      });

    directory_db.remote = {
      db: directory_paused,
      connection: null,
      create_handler: sync_handler,
      handler: null,
      info: directory_connection_info,
      options: {},
    };

    setLocalConnection(
      (directory_db as unknown) as Parameters<typeof setLocalConnection>[0]
    );
  } else {
    // Dummy data
    // This timeout 'yields' to allow other code to add 'paused' listeners
    // before the only 'paused' events are fired
    // Acts kind of like a dumber SyncHandler
    setTimeout(() => {
      setupExampleDirectory(directory_db.local)
        .then(async () => {
          events.emit(
            'directory_paused',
            await get_active_listings_in_this_directory(),
            []
          );
        })
        .catch(async err => {
          console.error('Error setting up dummy Directory', err);
          events.emit(
            'directory_paused',
            await get_active_listings_in_this_directory(),
            []
          );
        });
    }, 50);
  }
}

export function process_listings(
  listings: Set<string>,
  allow_nonexistant: boolean
) {
  listings.forEach(listing_id => {
    directory_db.local
      .get(listing_id)
      .then(listing_object => {
        process_listing(listing_object).catch(err => {
          events.emit('listing_error', listing_id, err);
        });
      })
      .catch(err => {
        console.log(
          err,
          'No local (listings object) for active DB',
          listing_id,
          'yet'
        );
        if (!allow_nonexistant) {
          console.error(
            'directory_synced emitted, but listing ',
            listing_id,
            'is missing'
          );
          events.emit('listing_error', listing_id, err);
        }
      });
  });
}

async function process_listing(listing_object: ListingsObject) {
  const listing_id = listing_object._id;
  console.debug(`Processing listing id ${listing_id}`);

  const projects_db_id = listing_object['projects_db']
    ? listing_id
    : DEFAULT_LISTING_ID;

  const projects_connection = materializeConnectionInfo(
    (await get_default_instance())['projects_db'],
    listing_object['projects_db']
  );

  const people_local_id = listing_object['people_db']
    ? listing_id
    : DEFAULT_LISTING_ID;

  const people_connection = materializeConnectionInfo(
    (await get_default_instance())['people_db'],
    listing_object['people_db']
  );

  const [, local_people_db] = ensure_local_db(
    'people',
    people_local_id,
    true,
    people_dbs
  );
  const [, local_projects_db] = ensure_local_db(
    'projects',
    projects_db_id,
    true,
    projects_dbs
  );

  // Only sync active projects:
  const get_active_projects_in_this_listing = async () => {
    const all_project_ids_in_this_listing = (
      await local_projects_db.local.allDocs()
    ).rows
      .map(row => row.id)
      .filter(id => !id.startsWith('_design/'));
    console.debug(
      `All projects in listing ${listing_id} are`,
      all_project_ids_in_this_listing
    );
    if (AUTOACTIVATE_PROJECTS) {
      await autoactivate_projects(listing_id, all_project_ids_in_this_listing);
    }

    const active_projects_in_this_listing = (
      await active_db.find({
        selector: {
          listing_id: listing_id,
          project_id: {$in: all_project_ids_in_this_listing},
        },
      })
    ).docs;

    console.debug(
      `Active projects in listing ${listing_id} are`,
      active_projects_in_this_listing
    );

    return active_projects_in_this_listing;
  };
  /**
   * List of projects in this listing that are also in the active DB
   * NOTE: This isn't updated, call get_active_projects_in_this_listing
   * after sufficient time (i.e. if the code you're writing is in a pause handler)
   */
  const unupdated_projects_in_this_listing = await get_active_projects_in_this_listing();

  events.emit(
    'listing_local',
    listing_object,
    unupdated_projects_in_this_listing,
    local_people_db,
    local_projects_db
  );

  if (USE_REAL_DATA) {
    const people_sync_handler = () =>
      new SyncHandler<PeopleDoc>(LISTINGS_TIMEOUT, {
        active: () => {},
        paused: () => {},
        error: () => {},
      });

    // TODO: Ensure that when the user adds a new active project
    // that these filters are updated.
    ensure_synced_db(
      people_local_id,
      people_connection,
      people_dbs,
      people_sync_handler,
      // Filters to only projects that are active
      unupdated_projects_in_this_listing.map(v => v._id)
    );

    const project_sync_handler = () =>
      new SyncHandler<ProjectObject>(LISTINGS_TIMEOUT, {
        active: async () =>
          events.emit(
            'listing_active',
            listing_object,
            await get_active_projects_in_this_listing(),
            local_people_db,
            local_projects_db,
            projects_connection
          ),
        paused: async changes => {
          if (!USE_REAL_DATA)
            await setupExampleListing(
              listing_object._id,
              local_projects_db.local
            );
          events.emit(
            'listing_paused',
            listing_object,
            await get_active_projects_in_this_listing(),
            local_people_db,
            local_projects_db,
            projects_connection,
            changes
          );
        },
        error: async () => {
          events.emit(
            'listing_paused',
            listing_object,
            await get_active_projects_in_this_listing(),
            local_people_db,
            local_projects_db,
            projects_connection,
            []
          );
        },
      });

    ensure_synced_db(
      projects_db_id,
      projects_connection,
      projects_dbs,
      project_sync_handler,
      // Filters to only projects that are active
      unupdated_projects_in_this_listing.map(v => v._id)
    );
  } else {
    // Dummy data
    // This timeout 'yields' to allow other code to add 'paused' listeners
    // before the only 'paused' events are fired
    // Acts kind of like a dumber SyncHandler
    setTimeout(() => {
      setupExampleListing(listing_id, local_projects_db.local)
        .then(async () => {
          events.emit(
            'listing_paused',
            listing_object,
            await get_active_projects_in_this_listing(),
            local_people_db,
            local_projects_db,
            projects_connection,
            []
          );
        })
        .catch(async err => {
          console.error('Error setting up dummy Listing', listing_id, err);
          events.emit(
            'listing_paused',
            listing_object,
            await get_active_projects_in_this_listing(),
            local_people_db,
            local_projects_db,
            projects_connection,
            []
          );
        });
    });
  }
}

async function autoactivate_projects(
  listing_id: string,
  project_ids: NonUniqueProjectID[]
) {
  for (const project_id of project_ids) {
    try {
      await activate_project(listing_id, project_id, null, null);
    } catch (err) {
      const active_id = resolve_project_id(listing_id, project_id);
      console.debug('Unable to autoactivate', active_id);
    }
  }
}

async function activate_project(
  listing_id: string,
  project_id: NonUniqueProjectID,
  username: string | null,
  password: string | null,
  is_sync = true
): Promise<ProjectID> {
  if (project_id.startsWith('_design/')) {
    throw Error(`Cannot activate design document ${project_id}`);
  }
  if (project_id.startsWith('_')) {
    console.error('Projects should not start with a underscore: ', project_id);
  }
  const active_id = resolve_project_id(listing_id, project_id);
  try {
    await active_db.get(active_id);
    console.debug('Have already activated', active_id);
  } catch (err) {
    if (err.status === 404) {
      // TODO: work out a better way to do this
      await active_db.put({
        _id: active_id,
        listing_id: listing_id,
        project_id: project_id,
        username: username,
        password: password,
        is_sync: is_sync,
      });
      return active_id;
    } else {
      throw err;
    }
  }
}

export function process_projects(
  listing: ListingsObject,
  active_projects: ExistingActiveDoc[],
  people_db: LocalDB<PeopleDoc>,
  projects_db: LocalDB<ProjectObject>,
  default_connection: ConnectionInfo,
  allow_nonexistant: boolean
) {
  active_projects.forEach(ap => {
    projects_db.local
      .get(ap.project_id)
      .then(project_object => {
        process_project(listing, ap, default_connection, project_object).catch(
          err => {
            events.emit('project_error', listing, ap, err);
          }
        );
      })
      .catch(err => {
        console.log(err, 'No', ap.project_id, 'in', projects_db.local);
        if (!allow_nonexistant) {
          events.emit('project_error', listing, ap, err);
        }
      });
  });
}

async function process_project(
  listing: ListingsObject,
  active_project: ExistingActiveDoc,
  projects_db_connection: ConnectionInfo,
  project_object: ProjectObject
): Promise<void> {
  /**
   * Each project needs to know it's active_id to lookup the local
   * metadata/data databases.
   */
  const active_id = active_project._id;
  console.debug(`Processing project ${active_id}`);

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

  // Defaults to the same couch as the projects db, but different database name:
  const meta_connection_info = materializeConnectionInfo(
    {
      ...projects_db_connection,
      db_name: METADATA_DBNAME_PREFIX + project_object._id,
    },
    project_object.metadata_db
  );

  const data_connection_info = materializeConnectionInfo(
    {
      ...projects_db_connection,
      db_name: DATA_DBNAME_PREFIX + project_object._id,
    },
    project_object.data_db
  );

  if (USE_REAL_DATA) {
    const meta_sync_handler = (meta_db: LocalDB<ProjectMetaObject>) =>
      new SyncHandler<ProjectMetaObject>(PROJECT_TIMEOUT, {
        active: async () =>
          events.emit(
            'project_meta_active',
            listing,
            active_project,
            project_object,
            meta_db
          ),
        paused: async changes => {
          if (!USE_REAL_DATA)
            await setupExampleProjectMetadata(
              active_project._id,
              meta_db.local
            );
          events.emit(
            'project_meta_paused',
            listing,
            active_project,
            project_object,
            meta_db,
            changes
          );
        },
        error: async () => {
          if (!USE_REAL_DATA)
            await setupExampleProjectMetadata(
              active_project._id,
              meta_db.local
            );
          events.emit(
            'project_meta_paused',
            listing,
            active_project,
            project_object,
            meta_db,
            []
          );
        },
      });
    ensure_synced_db(
      active_id,
      meta_connection_info,
      metadata_dbs,
      meta_sync_handler
    );

    const data_sync_handler = (data_db: LocalDB<ProjectDataObject>) =>
      new SyncHandler<ProjectDataObject>(PROJECT_TIMEOUT, {
        active: async () =>
          events.emit(
            'project_data_active',
            listing,
            active_project,
            project_object,
            data_db
          ),
        paused: async changes => {
          events.emit(
            'project_data_paused',
            listing,
            active_project,
            project_object,
            data_db,
            changes
          );
        },
        error: async () => {
          events.emit(
            'project_data_paused',
            listing,
            active_project,
            project_object,
            data_db,
            []
          );
        },
      });

    ensure_synced_db(
      active_id,
      data_connection_info,
      data_dbs,
      data_sync_handler,
      {push: {}}
    );
  } else {
    // Dummy data
    // This timeout 'yields' to allow other code to add 'paused' listeners
    // before the only 'paused' events are fired
    // Acts kind of like a dumber SyncHandler
    setTimeout(() => {
      setupExampleData(active_project._id)
        .then(async () => {
          events.emit(
            'project_data_paused',
            listing,
            active_project,
            project_object,
            data_db_local,
            []
          );
        })
        .catch(async err => {
          console.error('Error setting up dummy Data', active_project._id, err);
          events.emit(
            'project_data_paused',
            listing,
            active_project,
            project_object,
            data_db_local,
            []
          );
        });

      setupExampleProjectMetadata(active_project._id, meta_db_local.local)
        .then(async () => {
          events.emit(
            'project_meta_paused',
            listing,
            active_project,
            project_object,
            meta_db_local,
            []
          );
        })
        .catch(async err => {
          console.error(
            'Error setting up dummy Metadata',
            active_project._id,
            err
          );
          events.emit(
            'project_meta_paused',
            listing,
            active_project,
            project_object,
            meta_db_local,
            []
          );
        });
    }, 50);
  }
}
