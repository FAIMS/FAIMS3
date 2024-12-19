import {ActionType} from '../context/actions';
import {SyncStatusCallbacks} from '@faims3/data-model';
import {AppDispatch} from '../context/store';

export type SyncActionTypes =
  | ActionType.IS_SYNCING_DOWN
  | ActionType.IS_SYNCING_UP;

export function startSync(dispatch: AppDispatch, syncAction: SyncActionTypes) {
  /**
   * Dispatch IS_SYNCING_UP or IS_SYNCING_DOWN =true
   * Set to false after 5 seconds
   */
  const controller = new AbortController();

  dispatch({type: syncAction, payload: true});
  const apiTimeout = setTimeout(() => {
    dispatch({type: syncAction, payload: false});
    clearTimeout(apiTimeout);
    controller.abort();
  }, 5000);

  return;
}

function sendErrorNotification(dispatch: AppDispatch, message: string) {
  dispatch({
    type: ActionType.ADD_ALERT,
    payload: {message: message, severity: 'error'},
  });
}

export function setSyncError(dispatch: AppDispatch, has_error: boolean) {
  /**
   * Toggle the sync error state
   */
  dispatch({type: ActionType.IS_SYNC_ERROR, payload: has_error});
}

export function getSyncStatusCallbacks(
  dispatch: AppDispatch
): SyncStatusCallbacks {
  const handleStartSyncUp = () => {
    startSync(dispatch, ActionType.IS_SYNCING_UP);
    setSyncError(dispatch, false); // no error if we're syncing
  };
  const handleStartSyncDown = () => {
    startSync(dispatch, ActionType.IS_SYNCING_DOWN);
    setSyncError(dispatch, false); // no error if we're syncing
  };
  const handleStartSyncError = () => {
    setSyncError(dispatch, true);
  };
  const handleStartSyncDenied = () => {
    // TODO: Add denied status
    sendErrorNotification(
      dispatch,
      'Sync Authentication Error: try refreshing your roles'
    );
    setSyncError(dispatch, true);
  };
  return {
    sync_up: handleStartSyncUp,
    sync_down: handleStartSyncDown,
    sync_error: handleStartSyncError,
    sync_denied: handleStartSyncDenied,
  };
}
