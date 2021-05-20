import EventEmitter from 'events';
import {ProjectObject, ProjectMetaObject} from '../datamodel';

export type ProjectMetaList = {
  [active_id: string]: [ProjectObject, PouchDB.Database<ProjectMetaObject>];
};

export const state = {
  stabilized: false,
  project_metas: {} as ProjectMetaList,
};

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
