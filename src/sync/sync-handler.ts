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
interface EmissionsArg<Content extends {}> {
  active(): unknown;
  paused(changes: PouchDB.Core.ExistingDocument<Content>[]): unknown;
  error(err: {}): unknown;
}
/**
 * Translates 'paused', 'active', and 'change' events from a
 * PouchDB to the events that events.ts works with.
 *
 * This was created when the assumptions I made about pouch were wrong,
 * Pouch should theoretically batch its updates, so in the future
 * I hope to be able to remove this class.
 */
export class SyncHandler<Content extends {}> {
  lastActive?: ReturnType<typeof Date.now>;
  timeout: number;
  timeout_track?: ReturnType<typeof setTimeout>;
  emissions: EmissionsArg<Content>;
  tracked_changes: PouchDB.Core.ExistingDocument<Content>[] = [];

  constructor(timeout: number, emissions: EmissionsArg<Content>) {
    this.timeout = timeout;

    this.emissions = emissions;

    this.listener_error = this.listener_error.bind(this);
    this.listener_changed = this.listener_changed.bind(this);
    this.listener_paused = this.listener_paused.bind(this);

    this.setTimeout().then(() => {
      // After 2 seconds of no initial activity,
      // Mark the data as stopped coming in
      this.emissions.paused(this.tracked_changes);
      this.tracked_changes = [];
    });
  }
  _inactiveCheckLoop() {
    if (this.lastActive! + this.timeout - 20 <= Date.now()) {
      // Timeout (minus wiggle room) (or more) has elapsed since being active
      this.lastActive = undefined;
      this.emissions.paused(this.tracked_changes);
      this.tracked_changes = [];
    } else {
      // Set a new timeout for the remaining time of the 2 seconds.
      this.setTimeout(this.lastActive! + this.timeout - Date.now()).then(
        this._inactiveCheckLoop.bind(this)
      );
    }
  }

  listener_paused(err?: {}) {
    /*
    This event fires when the replication is paused, either because a live
    replication is waiting for changes, or replication has temporarily
    failed, with err, and is attempting to resume.
    */
    this.lastActive = undefined;
    this.clearTimeout();
    if (err === undefined || err === null) {
      this.emissions.paused(this.tracked_changes);
      this.tracked_changes = [];
    } else {
      this.emissions.error(err);
    }
  }

  listener_changed(changes: PouchDB.Core.ExistingDocument<Content>[]) {
    /*
    This event fires when the replication starts actively processing changes;
    e.g. when it recovers from an error or new changes are available.
    */

    this.tracked_changes.push(...changes);

    if (
      this.lastActive !== undefined &&
      this.lastActive! + this.timeout - 20 <= Date.now()
    ) {
      console.warn(
        "someone didn't clear the lastActive when clearTimeout called"
      );
      this.lastActive = undefined;
    }

    if (this.lastActive === undefined) {
      this.lastActive = Date.now();
      this.clearTimeout();
      this.emissions.active();

      // After 2 seconds of no more 'active' events,
      // assume it's up to date
      // (Otherwise, if it's still active, keep checking until it's not)
      this.setTimeout().then(this._inactiveCheckLoop.bind(this));
    } else {
      this.lastActive = Date.now();
    }
  }

  listener_error(err: {}) {
    /*
    This event is fired when the replication is stopped due to an
    unrecoverable failure.
    */
    // Prevent any further events
    this.lastActive = undefined;
    this.clearTimeout();
    this.emissions.error(err);
  }

  // Requires that the given changes has
  listen_local(changes_include_doc: PouchDB.Core.Changes<Content>) {
    changes_include_doc.on('change', change => {
      this.listener_changed([change.doc!]);
      this.tracked_changes.push(change.doc!);
    });
  }

  listen_remote<
    D extends
      | PouchDB.Replication.Sync<Content>
      | PouchDB.Replication.Replication<Content>
  >(db: D, changes_include_doc: PouchDB.Core.Changes<Content>) {
    db.on('paused', this.listener_paused);
    changes_include_doc.on('change', change => {
      this.listener_changed([change.doc!]);
      this.tracked_changes.push(change.doc!);
    });
    // This is a valid conversion. Typescript doesn't like this, but
    // it's valid because either thing that DB can be has a 'change' event,
    // They give different argument types, though.
    ((db as unknown) as {
      on(
        event: 'change',
        listener: (
          info:
            | PouchDB.Replication.ReplicationResult<Content>
            | PouchDB.Replication.SyncResult<Content>
        ) => any
      ): D;
    }).on('change', changes => {
      if ('direction' in changes && changes.direction === 'pull') {
        this.listener_changed(changes.change.docs);
      } else if ('docs' in changes) {
        this.listener_changed(changes.docs);
      }
    });
    db.on('error', this.listener_error);
  }
  clearTimeout() {
    if (this.timeout_track !== undefined) {
      clearTimeout(this.timeout_track);
      this.timeout_track = undefined;
    }
  }
  detach(
    db: PouchDB.Replication.ReplicationEventEmitter<{}, unknown, unknown>
  ) {
    db.removeListener('paused', this.listener_paused);
    db.removeListener('change', this.listener_changed);
    db.removeListener('error', this.listener_error);
    this.clearTimeout();
  }

  setTimeout(time?: number): Promise<void> {
    return new Promise(resolve => {
      this.timeout_track = setTimeout(() => {
        resolve();
      }, time || this.timeout);
    });
  }
}
