/**
 * Router handle for navigation outside the React component tree.
 *
 * `initialiseProjects` and other Redux thunks cannot call `useNavigate`, so the
 * data router created in App.tsx is registered here once at startup. Callers
 * (e.g. {@link navigateToNotebookListIfViewingProject}) can then redirect when
 * upstream archival/deletion removes a notebook the user still has open.
 */
import {createBrowserRouter} from 'react-router-dom';
import {NOTEBOOK_LIST_ROUTE} from './constants/routes';
import {parseNotebookRouteParams} from './utils/notebookRouteParams';

type AppRouter = ReturnType<typeof createBrowserRouter>;

let appRouter: AppRouter | null = null;

/** Called once from App.tsx after `createBrowserRouter`. */
export function registerAppRouter(router: AppRouter): void {
  appRouter = router;
}

/**
 * If the current URL is a notebook or record route for `projectId`, replace it
 * with the workspace list. No-op when the user is elsewhere (avoids surprising
 * navigation while browsing other notebooks).
 */
export function navigateToNotebookListIfViewingProject(
  projectId: string
): void {
  if (!appRouter) {
    return;
  }
  const params = parseNotebookRouteParams(appRouter.state.location.pathname);
  if (params?.projectId !== projectId) {
    return;
  }
  void appRouter.navigate(NOTEBOOK_LIST_ROUTE, {replace: true});
}
