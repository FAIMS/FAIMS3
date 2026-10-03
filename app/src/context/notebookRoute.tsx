/**
 * @file The notebook a screen sits in, and the moves within it. Everything
 * under the notebook route reads the plan from here rather than from the
 * route's own params, so a screen that needs more of it later gains it here
 * instead of gaining another segment.
 */

import {createContext, ReactNode, useContext, useMemo} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import * as ROUTES from '../constants/routes';
import {RecordRouteNotebook} from '../constants/routes';

export type NotebookRouteContextType = {
  /** The notebook on screen with the plan it stands on: what a link under it is built from. */
  notebook: RecordRouteNotebook;
  /** Where a screen under the notebook returns to, the plan it was opened from included. */
  notebookRoute: string;
  /** The plan to show, or none of them, which is the chooser. */
  showPlan: (planId?: string) => void;
};

const NotebookRouteContext = createContext<
  NotebookRouteContextType | undefined
>(undefined);

/**
 * @throws if used outside NotebookRouteProvider, which every screen under the
 * notebook route is
 */
export const useNotebookRoute = () => {
  const context = useContext(NotebookRouteContext);
  if (context === undefined) {
    throw new Error(
      'useNotebookRoute must be used within a NotebookRouteProvider'
    );
  }
  return context;
};

/** Mounted on the notebook route, so the notebook view and the record screens under it share one answer. */
export const NotebookRouteProvider = ({children}: {children: ReactNode}) => {
  const {serverId, projectId, planId} = useParams<{
    serverId: string;
    projectId: string;
    planId?: string;
  }>();
  const navigate = useNavigate();

  const value = useMemo(() => {
    // The route cannot match without the ids, so they are named, not optional.
    const notebook = {
      serverId: serverId as string,
      projectId: projectId as string,
      planId,
    };
    return {
      notebook,
      notebookRoute: ROUTES.getNotebookRoute(notebook),
      // Every move within a notebook replaces, so leaving one costs a single
      // Back press.
      showPlan: (nextPlanId?: string) =>
        navigate(
          ROUTES.getNotebookRoute({
            serverId: notebook.serverId,
            projectId: notebook.projectId,
            planId: nextPlanId,
          }),
          {replace: true}
        ),
    };
  }, [serverId, projectId, planId, navigate]);

  return (
    <NotebookRouteContext.Provider value={value}>
      {children}
    </NotebookRouteContext.Provider>
  );
};
