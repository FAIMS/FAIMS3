import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useAppSelector} from '../context/store';
import {NOTEBOOK_LIST_ROUTE} from './remoteProjectRemoval';
import {parseNotebookRouteParams} from './notebookRouteParams';

/**
 * Redirect away from notebook-scoped routes when the project no longer exists
 * in Redux (e.g. removed by upstream archival/deletion during `initialiseProjects`).
 *
 * Mounted once on the app root layout as a backup to
 * {@link handleRemoteProjectRemoved}: covers race windows where the URL still
 * references a project id that was just deleted from the store.
 *
 * Guards against false positives during startup:
 * - Waits until `projects.isInitialised` (InitialiseGate has finished).
 * - Requires the server to exist locally (unknown server id → no redirect).
 */
export function useProjectRouteGuard(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialised = useAppSelector(state => state.projects.isInitialised);
  const routeParams = parseNotebookRouteParams(location.pathname);

  const project = useAppSelector(state => {
    if (!routeParams) {
      return undefined;
    }
    return state.projects.servers[routeParams.serverId]?.projects[
      routeParams.projectId
    ];
  });

  const serverExists = useAppSelector(state => {
    if (!routeParams) {
      return false;
    }
    return !!state.projects.servers[routeParams.serverId];
  });

  useEffect(() => {
    if (!isInitialised || !routeParams || !serverExists || project) {
      return;
    }
    navigate(NOTEBOOK_LIST_ROUTE, {replace: true});
  }, [isInitialised, routeParams, serverExists, project, navigate]);
}
