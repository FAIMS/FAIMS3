/**
 * Graceful handling when a notebook disappears upstream (archived or deleted).
 *
 * `initialiseProjects` detects upstream lifecycle changes during directory sync.
 * When a local notebook is absent from the active directory listing, the app probes
 * GET `/api/notebooks/:id` and may remove the local copy. These helpers coordinate
 * React Query cleanup and navigation away from stale routes.
 *
 * Route parsing lives in {@link ./notebookRouteParams.ts}; the notebook page uses
 * {@link removedNotebookUnavailableCopy} when the project is already gone from Redux;
 * {@link useProjectRouteGuard} is the React-side backup redirect.
 */
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../buildconfig';
import {NOTEBOOK_LIST_ROUTE} from '../constants/routes';
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

/** Copy for the notebook unavailable page (not a global snackbar). */
export const removedNotebookUnavailableCopy = {
  title: `${NOTEBOOK_NAME_CAPITALIZED} unavailable`,
  message: `This ${NOTEBOOK_NAME} was archived or removed on the server and is no longer available on this device.`,
};

/**
 * Cleanup after directory sync removes a notebook the user had locally: cancel
 * cached queries and leave the route if it still points at the removed notebook.
 *
 * Called from `initialiseProjects` immediately after `removeProject` /
 * `detachProjectRetainLocalData`, only when `localProjectIdsAtStart` contains the id.
 */
export function handleRemoteProjectRemoved(projectId: string): void {
  cancelProjectQueries(projectId);
  navigateToNotebookListIfViewingProject(projectId);
}

export {NOTEBOOK_LIST_ROUTE};
