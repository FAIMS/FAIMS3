/**
 * Graceful handling when a notebook disappears upstream (archived or deleted).
 *
 * `initialiseProjects` detects missing/archived directory entries and removes the
 * local project from Redux. These helpers coordinate user feedback (alert),
 * React Query cleanup, and navigation away from stale notebook routes.
 *
 * Route parsing lives in {@link ./notebookRouteParams.ts}; record/notebook pages
 * use {@link removedNotebookAlert} directly; {@link useProjectRouteGuard} is the
 * React-side backup redirect.
 */
import {AlertColor} from '@mui/material/Alert';
import {NOTEBOOK_NAME} from '../buildconfig';
import {NOTEBOOK_LIST_ROUTE} from '../constants/routes';
import {addAlert} from '../context/slices/alertSlice';
import type {AppDispatch} from '../context/store';
import {navigateToNotebookListIfViewingProject} from '../appRouter';
import {queryClient} from '../queryClient';

/** Must match {@link RECORD_LIST_KEY_PREFIX} in customHooks.tsx. */
const RECORD_LIST_KEY_PREFIX = 'allrecords';

/** Must match {@link HYDRATION_KEY_PREFIX} in customHooks.tsx. */
const HYDRATION_KEY_PREFIX = 'recordhydration';

/**
 * Drop React Query caches keyed to a removed project so refetches do not call
 * into torn-down Pouch handles.
 */
export function cancelProjectQueries(projectId: string): void {
  void queryClient.removeQueries({
    queryKey: [RECORD_LIST_KEY_PREFIX, projectId],
  });
  void queryClient.removeQueries({
    queryKey: [HYDRATION_KEY_PREFIX, projectId],
  });
}

/** Snackbar copy shared by cleanup dispatch and the notebook unavailable page. */
export const removedNotebookAlert = {
  severity: 'warning' as AlertColor,
  title: `${NOTEBOOK_NAME} unavailable`,
  message: `This ${NOTEBOOK_NAME} was archived or removed on the server and is no longer available on this device.`,
  autoHideDuration: 12000,
};

/**
 * Full cleanup when directory sync confirms a notebook should leave the device.
 *
 * Called from `initialiseProjects` immediately after `removeProject` /
 * `detachProjectRetainLocalData`. Order: notify the user, cancel queries, then
 * leave the route if it still points at the removed notebook.
 */
export function handleRemoteProjectRemoved(
  dispatch: AppDispatch,
  projectId: string
): void {
  dispatch(addAlert(removedNotebookAlert));
  cancelProjectQueries(projectId);
  navigateToNotebookListIfViewingProject(projectId);
}

export {NOTEBOOK_LIST_ROUTE};
