import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  Link,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import * as ROUTES from '../constants/routes';
import {
  NotebookViewTabProvider,
  useNotebookTab,
  usePlanTab,
} from './notebookViewTab';

const notebook = {serverId: 'srv', projectId: 'proj'};
/** A second notebook on the same server, which the app bar links straight to. */
const otherNotebook = {serverId: 'srv', projectId: 'other'};
const notebookRoute = (planId?: string) =>
  ROUTES.getNotebookRoute({...notebook, planId});
const recordRoute = ROUTES.getViewRecordRoute({
  ...notebook,
  planId: 'lab',
  recordId: 'rec',
});

/** Reports the tab it is on, and moves on demand. */
const TabConsumer = ({
  name,
  useTab,
}: {
  name: string;
  useTab: typeof useNotebookTab;
}) => {
  const tab = useTab();
  return (
    <>
      <span data-testid={name}>{tab.current ?? 'none'}</span>
      <button onClick={() => tab.select(`${name}-tab`)}>move {name}</button>
    </>
  );
};

/** Holds state of its own, so a remount of the page shows up as a reset. */
const NotebookScreen = () => {
  const [typed, setTyped] = useState('');
  return (
    <>
      <TabConsumer name="notebook" useTab={useNotebookTab} />
      <TabConsumer name="plan" useTab={usePlanTab} />
      <span data-testid="query">{typed || 'nothing'}</span>
      <button onClick={() => setTyped('a search')}>search</button>
      <Link to={recordRoute}>open a record</Link>
      <Link to={notebookRoute('field')}>show the other plan</Link>
      <Link to={notebookRoute('lab')}>show the first plan</Link>
      <Link to={ROUTES.getNotebookRoute({...otherNotebook, planId: 'lab'})}>
        show the other notebook
      </Link>
    </>
  );
};

const RecordScreen = () => (
  <Link to={notebookRoute('lab')}>back to the notebook</Link>
);

/**
 * The nesting App.tsx uses: the provider stands on the notebook route, above
 * the record screens nested under it.
 */
const renderNotebook = (planId?: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: ROUTES.NOTEBOOK_ROUTE_PATH,
            element: (
              <NotebookViewTabProvider>
                <Outlet />
              </NotebookViewTabProvider>
            ),
            children: [
              {index: true, element: <NotebookScreen />},
              {
                path: ROUTES.VIEW_RECORD_ROUTE_PATH,
                element: <RecordScreen />,
              },
            ],
          },
        ],
        {initialEntries: [notebookRoute(planId)]}
      )}
    />
  );

describe('NotebookViewTabProvider', () => {
  it('leaves the tab standing across a record screen', async () => {
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move notebook'}));
    await userEvent.click(screen.getByRole('link', {name: 'open a record'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'back to the notebook'})
    );
    expect(screen.getByTestId('notebook')).toHaveTextContent('notebook-tab');
  });

  it("leaves a plan's tab standing across a record screen", async () => {
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    await userEvent.click(screen.getByRole('link', {name: 'open a record'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'back to the notebook'})
    );
    expect(screen.getByTestId('plan')).toHaveTextContent('plan-tab');
  });

  it("keeps a plan's tab out of the notebook's own", async () => {
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    expect(screen.getByTestId('plan')).toHaveTextContent('plan-tab');
    expect(screen.getByTestId('notebook')).toHaveTextContent('none');
  });

  it("keeps one plan's tab out of the next, and the notebook's own", async () => {
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    await userEvent.click(screen.getByRole('button', {name: 'move notebook'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'show the other plan'})
    );
    // A slug from one plan means nothing in the next, but the notebook's own
    // view is the same view either way
    expect(screen.getByTestId('plan')).toHaveTextContent('none');
    expect(screen.getByTestId('notebook')).toHaveTextContent('notebook-tab');
  });

  it("returns to a plan's own tab when that plan comes back", async () => {
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'show the other plan'})
    );
    await userEvent.click(
      screen.getByRole('link', {name: 'show the first plan'})
    );
    expect(screen.getByTestId('plan')).toHaveTextContent('plan-tab');
  });

  it('leaves the page it stands over alone when the plan changes', async () => {
    // Scoping the tab rather than remounting to reset it: a plan change would
    // otherwise discard the record search, the map and the scroll position
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'search'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'show the other plan'})
    );
    expect(screen.getByTestId('query')).toHaveTextContent('a search');
  });

  it('keeps one notebook out of another, plans of the same id included', async () => {
    // The app bar links straight from one notebook to the next, so the route
    // stays matched and the provider is never unmounted between them
    renderNotebook('lab');
    await userEvent.click(screen.getByRole('button', {name: 'move notebook'}));
    await userEvent.click(screen.getByRole('button', {name: 'move plan'}));
    await userEvent.click(
      screen.getByRole('link', {name: 'show the other notebook'})
    );
    expect(screen.getByTestId('notebook')).toHaveTextContent('none');
    expect(screen.getByTestId('plan')).toHaveTextContent('none');
  });

  it('refuses to serve a screen outside the notebook route', () => {
    // React logs the error it re-throws, which is noise the test expects
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    expect(() =>
      render(<TabConsumer name="notebook" useTab={useNotebookTab} />)
    ).toThrow(/NotebookViewTabProvider/);
    consoleError.mockRestore();
  });
});
