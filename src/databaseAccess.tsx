/* eslint-disable @typescript-eslint/no-unused-vars */
import {dummy_observations} from './dummyData';
import {
  ObservationList,
  ProjectInformation,
  ProjectsList,
  ProjectObject,
  ActiveDoc,
  ProjectID,
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
  project_id: ProjectID
): ProjectInformation | null {
  const proj = createdProjects[project_id];
  if (proj === undefined) {
    return null;
  }

  return {
    project_id: project_id,
    name: proj.project.name,
    description: proj.project.description || 'No description',
    last_updated: proj.project.last_updated || 'Unknown',
    created: proj.project.created || 'Unknown',
    status: proj.project.status || 'Unknown',
  };
}

export function getProject(project_id: ProjectID): createdProjectsInterface {
  /**
   * Return entire project object (project, active, meta, data).
   */
  return createdProjects[project_id];
}

export function updateProject(project_id: ProjectID) {}

export function removeProject(project_id: ProjectID) {}

export async function getObservationList(
  project_id: ProjectID
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
  return listFAIMSData(project_id);
}

// note the string below is a ProjectID, but typescript is kinda silly and
// doesn't let us do that
const observationsUpdated: {[project_id: string]: boolean} = {};

add_initial_listener(initializeEvents => {
  initializeEvents.on('project_data_paused', (listing, active) => {
    observationsUpdated[active._id] = true;
  });
});

/**
 * Registers a callback to be run whenever observationList is updated.
 * If the observationList already updated before this function is called, the callback is also run immediately.
 *
 * @param project_id listing_id & project_id (active doc ._id) to get observations of
 * @param callback Run whenever the list of observations might have changed, called with the list.
 * @returns 'Destructor' that removes the listener that this function added.
 */
export function listenObservationsList(
  project_id: ProjectID,
  callback: (observationList: ObservationList) => unknown
): () => void {
  const runCallback = () =>
    getObservationList(project_id)
      .then(callback)
      .catch(err => console.error('Uncaught observation list error'));

  const listener_func = (listing: unknown, active: ActiveDoc) => {
    if (active._id === project_id) runCallback();
  };

  initializeEvents.on('project_data_paused', listener_func);

  if (observationsUpdated[project_id]) runCallback();

  return () =>
    initializeEvents.removeListener('project_data_paused', listener_func);
}

export function listenObservation(observation_id: string) {}

export function updateObservation(observation_id: string) {}

export function removeObservation(observation_id: string) {}
