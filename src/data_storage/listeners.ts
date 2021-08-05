import {ActiveDoc, ProjectID, ObservationMetadataList} from '../datamodel';
import {ExistingActiveDoc} from '../sync/databases';
import {events} from '../sync/events';
import {add_initial_listener} from '../sync/event-handler-registration';
import {listObservationMetadata} from './internals';

// note the string below is a ProjectID, but typescript is kinda silly and
// doesn't let us do that
const observationsUpdated: {[project_id: string]: boolean} = {};

add_initial_listener(initializeEvents => {
  initializeEvents.on(
    'project_data_paused',
    (listing, active: ExistingActiveDoc) => {
      observationsUpdated[active._id] = true;
    }
  );
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
  callback: (observationList: ObservationMetadataList) => unknown
): () => void {
  const runCallback = () =>
    listObservationMetadata(project_id)
      .then(callback)
      .catch(err => console.error('Uncaught observation list error'));

  const listener_func = (listing: unknown, active: ActiveDoc) => {
    if (active._id === project_id) runCallback();
  };

  events.on('project_data_paused', listener_func);

  if (observationsUpdated[project_id]) runCallback();

  return () => events.removeListener('project_data_paused', listener_func);
}

export function listenObservation(observation_id: string) {}

export function updateObservation(observation_id: string) {}

export function removeObservation(observation_id: string) {}
