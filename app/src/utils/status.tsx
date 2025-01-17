import {ActionType} from '../context/actions';
import {SyncStatusCallbacks} from '@faims3/data-model';
import {AppDispatch} from '../context/store';
import {
  addAlert,
  setSyncError,
  setSyncingDown,
  setSyncingUp,
} from '../context/slices/syncSlice';

export type SyncActionTypes =
  | ActionType.IS_SYNCING_DOWN
  | ActionType.IS_SYNCING_UP;

export function startSync(dispatch: AppDispatch, syncAction: SyncActionTypes) {
  /**
   * Dispatch IS_SYNCING_UP or IS_SYNCING_DOWN =true
   * Set to false after 5 seconds
   */
  const controller = new AbortController();

  switch (syncAction) {
    case ActionType.IS_SYNCING_DOWN:
      dispatch(setSyncingDown(true));
      const downTimeout = setTimeout(() => {
        dispatch(setSyncingDown(false));
        clearTimeout(downTimeout);
        controller.abort();
      }, 5000);
      return;
    case ActionType.IS_SYNCING_UP:
      dispatch(setSyncingUp(true));
      const upTimeout = setTimeout(() => {
        dispatch(setSyncingUp(false));
        clearTimeout(upTimeout);
        controller.abort();
      }, 5000);
      return;
  }
}

function sendErrorNotification(dispatch: AppDispatch, message: string) {
  dispatch(
    addAlert({
      message: message,
      severity: 'error',
    })
  );
}

export function localSetSyncError(dispatch: AppDispatch, has_error: boolean) {
  /**
   * Toggle the sync error state
   */
  dispatch(setSyncError(has_error));
}

export function getSyncStatusCallbacks(
  dispatch: AppDispatch
): SyncStatusCallbacks {
  const handleStartSyncUp = () => {
    startSync(dispatch, ActionType.IS_SYNCING_UP);
    localSetSyncError(dispatch, false); // no error if we're syncing
  };
  const handleStartSyncDown = () => {
    startSync(dispatch, ActionType.IS_SYNCING_DOWN);
    localSetSyncError(dispatch, false); // no error if we're syncing
  };
  const handleStartSyncError = () => {
    localSetSyncError(dispatch, true);
  };
  const handleStartSyncDenied = () => {
    // TODO: Add denied status
    sendErrorNotification(
      dispatch,
      'Sync Authentication Error: try refreshing your roles'
    );
    localSetSyncError(dispatch, true);
  };
  return {
    sync_up: handleStartSyncUp,
    sync_down: handleStartSyncDown,
    sync_error: handleStartSyncError,
    sync_denied: handleStartSyncDenied,
  };
}
