import {ActionType} from '../context/actions';
import {ContextType} from '../context/store';

export type SyncActionTypes =
  | ActionType.IS_SYNCING_DOWN
  | ActionType.IS_SYNCING_UP;

export function startSync(
  dispatch: ContextType['dispatch'],
  syncAction: SyncActionTypes
) {
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

export function setSyncError(
  dispatch: ContextType['dispatch'],
  has_error: boolean
) {
  /**
   * Toggle the sync error state
   */
  dispatch({type: ActionType.IS_SYNC_ERROR, payload: has_error});
}
