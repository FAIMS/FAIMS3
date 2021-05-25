/* eslint-disable @typescript-eslint/no-unused-vars */
import {dummy_observations} from './dummyData';
import {
  ObservationList,
  ProjectInformation,
  ProjectsList,
  ProjectObject,
  ActiveDoc,
} from './datamodel';
import {listFAIMSData} from './dataStorage';
import {
  add_initial_listener,
  createdProjects,
  createdProjectsInterface,
  initializeEvents,
} from './sync';

export function getProjectList(user_id?: string): typeof createdProjects {
  /**
   * Return all active projects the user has access to, including the
   * top 30 most recently updated observations.
   */
  // TODO filter by user_id
  // TODO filter by active projects
  // TODO filter data by top 30 entries, sorted by most recently updated
  // TODO decode .data
  const decodedProjects = [];
  return createdProjects;
}

export function getProjectInfo(
  listing_id_project_id: string
): ProjectInformation | null {
  const proj = createdProjects[listing_id_project_id];
  if (proj === undefined) {
    return null;
  }

  return {
    _id: proj.project._id,
    name: proj.project.name,
    description: proj.project.description || 'No description',
    last_updated: proj.project.last_updated || 'Unknown',
    created: proj.project.created || 'Unknown',
    status: proj.project.status || 'Unknown',
  };
}

export function getProject(
  listing_id_project_id: string
): createdProjectsInterface {
  /**
   * Return entire project object (project, active, meta, data).
   */
  return createdProjects[listing_id_project_id];
}

export function updateProject(project_id: string) {}

export function removeProject(project_id: string) {}

export async function getObservationList(
  listing_id_project_id: string
): Promise<ObservationList> {
  /**
   * Return all observations for a given project_id.
   * TODO project_id could be optional and return recently updated for home page
   * TODO truncate this to top 100?
   */
  // const observation_keys = Object.keys(dummy_observations).filter(
  //   key => dummy_observations[key]._project_id === project_id
  // );
  // return observation_keys.reduce(
  //   (obj, key) => ({...obj, [key]: dummy_observations[key]}),
  //   {}
  // );
  return listFAIMSData(listing_id_project_id);
}

const observationsUpdated: {[listing_id_project_id: string]: boolean} = {};

add_initial_listener(initializeEvents => {
  initializeEvents.on('project_data_paused', (listing, active) => {
    observationsUpdated[active._id] = true;
  });
});

/**
 * Registers a callback to be run whenever observationList is updated.
 * If the observationList already updated before this function is called, the callback is also run immediately.
 *
 * @param listing_id_project_id listing_id & project_id (active doc ._id) to get observations of
 * @param callback Run whenever the list of observations might have changed, called with the list.
 * @returns 'Destructor' that removes the listener that this function added.
 */
export function listenObservationsList(
  listing_id_project_id: string,
  callback: (observationList: ObservationList) => unknown
): () => void {
  const runCallback = () =>
    getObservationList(listing_id_project_id)
      .then(callback)
      .catch(err => console.error('Uncaught observation list error'));

  const listener_func = (listing: unknown, active: ActiveDoc) => {
    if (active._id === listing_id_project_id) runCallback();
  };

  initializeEvents.on('project_data_paused', listener_func);

  if (observationsUpdated[listing_id_project_id]) runCallback();

  return () =>
    initializeEvents.removeListener('project_data_paused', listener_func);
}

export function updateObservation(observation_id: string) {}

export function removeObservation(observation_id: string) {}
