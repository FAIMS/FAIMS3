/**
 * @file The notebook a screen sits in, and the moves within it. Everything
 * under the notebook route reads the plan and tab from here rather than from
 * the route's own params, so a screen that needs more of them later gains it
 * here instead of gaining another segment.
 */

import {createContext, ReactNode, useContext, useMemo} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import * as ROUTES from '../constants/routes';
import {RecordRouteNotebook} from '../constants/routes';

export type NotebookRouteContextType = {
  /** The notebook on screen with the plan and tab it stands on: what a link under it is built from. */
  notebook: RecordRouteNotebook;
  /** Where a screen under the notebook returns to, the plan and tab it was opened from included. */
  notebookRoute: string;
  /**
   * The plan and tab to show, both absolute: a lone trailing segment reads as
   * either, so only the notebook view, which knows the plans, can say what the
   * pair is.
   */
  showPlanTab: (next: {planId?: string; tab?: string}) => void;
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
  const {serverId, projectId, planId, tab} = useParams<{
    serverId: string;
    projectId: string;
    planId?: string;
    tab?: string;
  }>();
  const navigate = useNavigate();

  const value = useMemo(() => {
    // The route cannot match without the ids, so they are named, not optional.
    const notebook = {
      serverId: serverId as string,
      projectId: projectId as string,
      planId,
      tab,
    };
    return {
      notebook,
      notebookRoute: ROUTES.getNotebookRoute(notebook),
      // Every move within a notebook replaces, plan and tab alike, so leaving
      // one costs a single Back press.
      showPlanTab: (next: {planId?: string; tab?: string}) =>
        navigate(
          ROUTES.getNotebookRoute({
            serverId: notebook.serverId,
            projectId: notebook.projectId,
            ...next,
          }),
          {replace: true}
        ),
    };
  }, [serverId, projectId, planId, tab, navigate]);

  return (
    <NotebookRouteContext.Provider value={value}>
      {children}
    </NotebookRouteContext.Provider>
  );
};
