/* eslint-disable @typescript-eslint/no-unused-vars */
import {dummy_observations} from './dummyData';
import {
  ObservationList,
  ProjectInformation,
  ProjectsList,
  ProjectObject,
} from './datamodel';
import {convertFromDBToForm, lookupFAIMSDataID} from './dataStorage';
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

export function getObservationList(
  listing_id_project_id: string
): ObservationList | Array<any> {
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
  const observations = getProject(listing_id_project_id);

  console.log(observations);
  return [];
  // return observations.data ? convertFromDBToForm(observations.data) : []
  // return observations.map(obs => convertFromDBToForm(obs));
}

export function updateObservation(observation_id: string) {}

export function removeObservation(observation_id: string) {}
