import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NotebookRouteProvider, useNotebookRoute} from './notebookRoute';

const {navigate, routeParams} = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {
    current: {} as {
      serverId?: string;
      projectId?: string;
      planId?: string;
    },
  },
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
  useParams: () => routeParams.current,
}));

/** Reports what the context says, and moves within the notebook on demand. */
const Consumer = () => {
  const {notebook, notebookRoute, showPlan} = useNotebookRoute();
  return (
    <>
      <span data-testid="notebook">{JSON.stringify(notebook)}</span>
      <span data-testid="notebook-route">{notebookRoute}</span>
      <button onClick={() => showPlan('lab')}>show a plan</button>
      <button onClick={() => showPlan()}>change plan</button>
    </>
  );
};

const renderConsumer = (params: {planId?: string}) => {
  routeParams.current = {serverId: 'srv', projectId: 'proj', ...params};
  render(
    <NotebookRouteProvider>
      <Consumer />
    </NotebookRouteProvider>
  );
};

beforeEach(() => navigate.mockClear());

describe('useNotebookRoute', () => {
  it('names the notebook the route addresses, plan included', () => {
    renderConsumer({planId: 'lab'});
    expect(screen.getByTestId('notebook')).toHaveTextContent(
      JSON.stringify({
        serverId: 'srv',
        projectId: 'proj',
        planId: 'lab',
      })
    );
  });

  it('returns a screen under the notebook to the plan it was opened from', () => {
    renderConsumer({planId: 'lab'});
    expect(screen.getByTestId('notebook-route')).toHaveTextContent(
      '/surveys/srv/proj/lab'
    );
  });

  it('replaces the entry on a move within the notebook', async () => {
    renderConsumer({});
    await userEvent.click(screen.getByRole('button', {name: 'show a plan'}));
    expect(navigate).toHaveBeenCalledWith('/surveys/srv/proj/lab', {
      replace: true,
    });
  });

  it('drops the plan to return to the chooser', async () => {
    renderConsumer({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'change plan'}));
    expect(navigate).toHaveBeenCalledWith('/surveys/srv/proj', {replace: true});
  });

  it('refuses to serve a screen outside the notebook route', () => {
    // React logs the error it re-throws, which is noise the test expects
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    expect(() => render(<Consumer />)).toThrow(/NotebookRouteProvider/);
    consoleError.mockRestore();
  });
});
