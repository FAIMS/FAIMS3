import EventEmitter from 'node:events';
import {add_initial_listener} from '.';
import {ProjectObject, ProjectMetaObject} from '../datamodel';

export type ProjectMetaList = {
  [active_id: string]: [ProjectObject, PouchDB.Database<ProjectMetaObject>];
};

export const state = {
  stabilized: false,
  project_metas: {} as ProjectMetaList,
};

// Listen for events from sync and convert them to ProjectsEvents events
add_initial_listener(initializeEvents => {
  initializeEvents.on('project_local', (_listing, active, project, meta) => {
    const added: ProjectMetaList = {};
    if (!(active._id in state.project_metas)) {
      added[active._id] = [project, meta.local];
      state.project_metas[active._id] = [project, meta.local];
    }

    events.emit('project_meta_update', state.project_metas, added, []);
  });
});

export const events: StatefulEvents = new EventEmitter();
export interface StatefulEvents extends EventEmitter {
  /**
   * This event is emitted when the directory & all listings stop syncing
   * So a good way to tell
   * @param event project_meta_stabilize
   * @param listener Called with all currently known projects
   */
  on(
    event: 'project_meta_stabilize',
    listener: (project_metas: ProjectMetaList) => unknown
  ): this;
  on(
    event: 'project_meta_update',
    listener: (
      project_metas: ProjectMetaList,
      added: ProjectMetaList,
      removed: string[]
    ) => unknown
  ): this;
}
