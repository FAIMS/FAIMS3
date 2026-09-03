/**
 * @file The tab a notebook view is on. Held on the notebook route, above the
 * record screens nested under it, so opening a record and coming back returns
 * to the tab that was left without the tab ever reaching the URL.
 *
 * The notebook's own view and a plan's view get a context each, so a plan
 * models its screens however it likes rather than sharing the tabs the default
 * view carries. Each holds a tab per thing it belongs to rather than one tab
 * outright: the app bar links straight from one notebook to the next, which
 * leaves this mounted, and a slug from one notebook or plan means nothing in
 * the next.
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
import {NotebookViewTab} from '../gui/components/notebook/types';

/** The tab each view is on, by the notebook or plan it belongs to. */
interface TabStore {
  tabs: Record<string, string>;
  select: (scope: string, tab: string) => void;
}

const NotebookTabContext = createContext<TabStore | undefined>(undefined);
const PlanTabContext = createContext<TabStore | undefined>(undefined);

const TabProvider = ({
  context,
  children,
}: {
  context: Context<TabStore | undefined>;
  children: ReactNode;
}) => {
  const [tabs, setTabs] = useState<Record<string, string>>({});
  const value = useMemo(
    () => ({
      tabs,
      select: (scope: string, tab: string) =>
        setTabs(current => ({...current, [scope]: tab})),
    }),
    [tabs]
  );
  return <context.Provider value={value}>{children}</context.Provider>;
};

const useScopedTab = (
  context: Context<TabStore | undefined>,
  scope: string
): NotebookViewTab => {
  const store = useContext(context);
  if (store === undefined) {
    throw new Error('tab read outside NotebookViewTabProvider');
  }
  return useMemo(
    () => ({
      current: store.tabs[scope],
      select: (tab: string) => store.select(scope, tab),
    }),
    [store, scope]
  );
};

/**
 * @throws if used outside NotebookViewTabProvider, which every screen under the
 * notebook route is
 */
export const useNotebookTab = (): NotebookViewTab => {
  const {serverId, projectId} = useParams();
  return useScopedTab(NotebookTabContext, `${serverId}/${projectId}`);
};

/**
 * @throws if used outside NotebookViewTabProvider, which every screen under the
 * notebook route is
 */
export const usePlanTab = (): NotebookViewTab => {
  const {serverId, projectId, planId} = useParams();
  return useScopedTab(PlanTabContext, `${serverId}/${projectId}/${planId}`);
};

/** Mounted on the notebook route, so a record screen under it leaves the tabs standing. */
export const NotebookViewTabProvider = ({children}: {children: ReactNode}) => (
  <TabProvider context={NotebookTabContext}>
    <TabProvider context={PlanTabContext}>{children}</TabProvider>
  </TabProvider>
);
