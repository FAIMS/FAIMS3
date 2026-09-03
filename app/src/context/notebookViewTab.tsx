/**
 * @file The tab a notebook view is on. Held on the notebook route, above the
 * record screens nested under it, so opening a record and coming back returns
 * to the tab that was left without the tab ever reaching the URL.
 *
 * The notebook's own view and a plan's view get a context each, so a plan
 * models its screens however it likes rather than sharing the tabs the default
 * view carries. A plan's tab starts over when the plan on screen changes, since
 * a slug from one plan means nothing in the next.
 */

import {
  createContext,
  Context,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import {useParams} from 'react-router-dom';

/** The tab a view is on, and the way it moves. */
export interface NotebookViewTab {
  /** Absent until the view has moved, which is the view's own default. */
  current: string | undefined;
  select: (tab: string) => void;
}

const NotebookTabContext = createContext<NotebookViewTab | undefined>(
  undefined
);
const PlanTabContext = createContext<NotebookViewTab | undefined>(undefined);

const TabProvider = ({
  context,
  children,
}: {
  context: Context<NotebookViewTab | undefined>;
  children: ReactNode;
}) => {
  const [current, select] = useState<string>();
  const value = useMemo(() => ({current, select}), [current]);
  return <context.Provider value={value}>{children}</context.Provider>;
};

const useTab = (
  context: Context<NotebookViewTab | undefined>,
  provider: string
) => {
  const value = useContext(context);
  if (value === undefined) {
    throw new Error(`tab read outside ${provider}`);
  }
  return value;
};

/**
 * @throws if used outside NotebookViewTabProvider, which every screen under the
 * notebook route is
 */
export const useNotebookTab = () =>
  useTab(NotebookTabContext, 'NotebookViewTabProvider');

/**
 * @throws if used outside NotebookViewTabProvider, which every screen under the
 * notebook route is
 */
export const usePlanTab = () =>
  useTab(PlanTabContext, 'NotebookViewTabProvider');

/** Mounted on the notebook route, so a record screen under it leaves the tabs standing. */
export const NotebookViewTabProvider = ({children}: {children: ReactNode}) => {
  const {planId} = useParams<{planId?: string}>();
  return (
    <TabProvider context={NotebookTabContext}>
      <TabProvider key={planId} context={PlanTabContext}>
        {children}
      </TabProvider>
    </TabProvider>
  );
};
