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

import {events} from './events';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {ProjectID} from '../datamodel/core';
import {ProjectDataObject, ProjectMetaObject} from '../datamodel/database';
import {data_dbs, ExistingActiveDoc, metadata_dbs} from './databases';
import {all_projects_updated, createdProjectsInterface} from './state';

PouchDB.plugin(PouchDBFind);

export async function getDataDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectDataObject>> {
  if (!all_projects_updated) {
    // Wait for all_projects_updated to possibly change before re-polling
    // all_projects_updated and returning error/data DB if it's ready.
    return new Promise((resolve, reject) => {
      const listener = () => {
        getDataDB(active_id).then(resolve, reject);
        events.removeListener('all_state', listener);
      };
      events.addListener('all_state', listener);
    });
  } else {
    if (active_id in data_dbs) {
      return data_dbs[active_id].local;
    } else {
      throw `Project ${active_id} is not known`;
    }
  }
}

/**
 * Allows you to listen for changes from a Project's Data DB.
 * This is a working alternative to getDataDB.changes
 * (as getDataDB.changes that may detach after updates to the owning listing
 * or the owning active DB, or if the sync is toggled on/off)
 *
 * @param active_id Project ID to listen on the DB for.
 * @param change_opts
 * @param change_listener
 * @param error_listener
 * @returns Detach function: call this to stop all changes
 */
export function listenDataDB(
  active_id: ProjectID,
  change_opts: PouchDB.Core.ChangesOptions,
  change_listener: (
    value: PouchDB.Core.ChangesResponseChange<ProjectDataObject>
  ) => any,
  error_listener: (value: any) => any
): () => void {
  // This is an array to allow it to be read/writeable from closures
  // Its value: Changes from the Data DB of the project we're listening on, if
  // said Data DB is available & valid. (Only after 'update' | 'create' events)
  const current_changes: [
    'deleted' | null | PouchDB.Core.Changes<ProjectDataObject>
  ] = [null];

  const project_update_cb = (
    type: ['update', createdProjectsInterface] | ['delete'] | ['create'],
    meta_changed: boolean,
    data_changed: boolean,
    listing: unknown,
    active: ExistingActiveDoc
  ) => {
    if (active_id === active._id) {
      if (data_changed) {
        // Database has changed, re-attach
        current_changes[0] = data_dbs[active_id]!.local.changes(change_opts);
        current_changes[0].on('change', change_listener);
        current_changes[0].on('error', error_listener);

        // As long as this database continues to exist, all_state doesn't need
        // to check. Since event emitters are limited in size, remove unnecessary:
        // (However, if a 'delete' event comes in, all_state will be needed again)
        events.removeListener('all_state', all_state_cb);
      } else if (type[0] === 'delete') {
        // The following could cause the next all_state_cb call to throw an error
        // Because once a project is deleted, this is called first then
        // all_state_cb will know current_changes[0] === null.
        // UNLESS the user calls the destructor (detach_cb) between
        // a project_update event and all_state event. Which they should be
        // doing (since they should be listening on project_update to
        // destroy themselves. (e.g. react elements)).
        events.on('all_state', all_state_cb);
        current_changes[0] = 'deleted';
      }
    }
  };

  events.on('project_update', project_update_cb);

  /*
  All state is monitored because, just like getDataDB, when all projects are
  know and the changes hasn't been set yet, the user has tried to listen on
  a Data DB that doesn't exist.
  */
  const all_state_cb = () => {
    if (all_projects_updated && current_changes[0] === null) {
      error_listener(Error(`Project ${active_id} is not known`));
      detach_cb();
    } else if (all_projects_updated && current_changes[0] === 'deleted') {
      console.warn(
        `Project ${active_id} did exist, was deleted, but a function` +
          "listening to events on it's data DB didn't call the listener's " +
          'detacher function at the right time (immediately after' +
          'project_update event for the corresponding project id)'
      );
      // Allow the project to be undeleted & have listeners still work:
      // So don't detach_cb here.
    }
  };

  events.on('all_state', all_state_cb);

  const detach_cb = () => {
    if (current_changes[0] !== null && current_changes[0] !== 'deleted') {
      // Detatch while the DB is still running
      // from external event (e.g. react element being destroyed
      current_changes[0].cancel();
    }
    events.removeListener('project_update', project_update_cb);
    events.removeListener('all_state', all_state_cb);
  };

  return detach_cb;
}

export async function getProjectDB(
  active_id: ProjectID
): Promise<PouchDB.Database<ProjectMetaObject>> {
  if (!all_projects_updated) {
    // Wait for all_projects_updated to possibly change before re-polling
    // all_projects_updated and returning error/data DB if it's ready.
    return new Promise((resolve, reject) => {
      const listener = () => {
        getDataDB(active_id).then(resolve, reject);
        events.removeListener('all_state', listener);
      };
      events.addListener('all_state', listener);
    });
  } else {
    if (active_id in metadata_dbs) {
      return metadata_dbs[active_id].local;
    } else {
      throw `Project ${active_id} is not known`;
    }
  }
}

/**
 * Allows you to listen for changes from a Project's Meta DB.
 * This is a working alternative to getProjectDB.changes
 * (as getProjectDB.changes that may detach after updates to the owning listing
 * or the owning active DB, or if the sync is toggled on/off)
 *
 * @param active_id Project ID to listen on the DB for.
 * @param change_opts
 * @param change_listener
 * @param error_listener
 * @returns Detach function: call this to stop all changes
 */
export function listenProjectDB(
  active_id: ProjectID,
  change_opts: PouchDB.Core.ChangesOptions,
  change_listener: (
    value: PouchDB.Core.ChangesResponseChange<ProjectMetaObject>
  ) => any,
  error_listener: (value: any) => any
): () => void {
  // This is an array to allow it to be read/writeable from closures
  // Its value: Changes from the Meta DB of the project we're listening on, if
  // said Meta DB is available & valid. (Only after 'update' | 'create' events)
  const current_changes: [
    'deleted' | null | PouchDB.Core.Changes<ProjectMetaObject>
  ] = [null];

  const project_update_cb = (
    type: ['update', createdProjectsInterface] | ['delete'] | ['create'],
    meta_changed: boolean,
    data_changed: boolean,
    listing: unknown,
    active: ExistingActiveDoc
  ) => {
    if (active_id === active._id) {
      if (meta_changed) {
        // Database has changed, re-attach
        current_changes[0] = metadata_dbs[active_id]!.local.changes(
          change_opts
        );
        current_changes[0].on('change', change_listener);
        current_changes[0].on('error', error_listener);

        // As long as this database continues to exist, all_state doesn't need
        // to check. Since event emitters are limited in size, remove unnecessary:
        // (However, if a 'delete' event comes in, all_state will be needed again)
        events.removeListener('all_state', all_state_cb);
      } else if (type[0] === 'delete') {
        // The following could cause the next all_state_cb call to throw an error
        // Because once a project is deleted, this is called first then
        // all_state_cb will know current_changes[0] === null.
        // UNLESS the user calls the destructor (detach_cb) between
        // a project_update event and all_state event. Which they should be
        // doing (since they should be listening on project_update to
        // destroy themselves. (e.g. react elements)).
        events.on('all_state', all_state_cb);
        current_changes[0] = null;
      }
    }
  };

  events.on('project_update', project_update_cb);

  /*
  All state is monitored because, just like getProjectDB, when all projects are
  know and the changes hasn't been set yet, the user has tried to listen on
  a Meta DB that doesn't exist.
  */
  const all_state_cb = () => {
    if (all_projects_updated && current_changes[0] === null) {
      error_listener(Error(`Project ${active_id} is not known`));
      detach_cb();
    } else if (all_projects_updated && current_changes[0] === 'deleted') {
      console.warn(
        `Project ${active_id} did exist, was deleted, but a function` +
          "listening to events on it's data DB didn't call the listener's " +
          'detacher function at the right time (immediately after' +
          'project_update event for the corresponding project id)'
      );
      // Allow the project to be undeleted & have listeners still work:
      // So don't detach_cb here.
    }
  };

  events.on('all_state', all_state_cb);

  const detach_cb = () => {
    if (current_changes[0] !== null && current_changes[0] !== 'deleted') {
      // Detatch while the DB is still running
      // from external event (e.g. react element being destroyed
      current_changes[0].cancel();
    }
    events.removeListener('project_update', project_update_cb);
    events.removeListener('all_state', all_state_cb);
  };

  return detach_cb;
}
