/* eslint-disable @typescript-eslint/no-unused-vars */
import {dummy_observations, dummy_projects} from './dummyData';
import {ProjectsList, ObservationList} from './datamodel';

export function getProjectList(): ProjectsList {
  return dummy_projects;
}

export function getProject(project_id: string) {
  return dummy_projects[project_id];
}

export function updateProject(project_id: string) {}

export function removeProject(project_id: string) {}

export function getObservationList(project_id: string): ObservationList {
  /**
   * Return all observations for a given project_id.
   * TODO project_id could be optional and return recently updated for home page
   * TODO truncate this to top 1000?
   */
  const observation_keys = Object.keys(dummy_observations).filter(
    key => dummy_observations[key]._project_id === project_id
  );
  return observation_keys.reduce(
    (obj, key) => ({...obj, [key]: dummy_observations[key]}),
    {}
  );
}

export function updateObservation(observation_id: string) {}

export function removeObservation(observation_id: string) {}
