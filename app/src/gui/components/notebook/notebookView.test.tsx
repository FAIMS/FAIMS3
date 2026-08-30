import '@testing-library/jest-dom';
import {NotebookDefinition, ProjectStatus} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as ROUTES from '../../../constants/routes';
import {Project} from '../../../context/slices/projectSlice';
import {NotebookView} from './notebookView';

const {navigate, routeParams} = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {current: {} as {planId?: string; tab?: string}},
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
  useParams: () => routeParams.current,
}));

// Every plan gets a view, which reports the one tab move the contract covers
vi.mock('./plans', async () => {
  const actual = await vi.importActual<object>('./plans');
  const React = await import('react');
  return {
    ...actual,
    getNotebookView: () => (props: any) =>
      React.createElement(
        'button',
        {onClick: () => props.actions.setTab('all-records')},
        'show a tab'
      ),
  };
});

const uiSpecification = {
  viewsets: {},
  views: {},
  fields: {},
  visible_types: [],
};

vi.mock('../../../context/store', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({username: 'testuser'}),
}));
vi.mock('../../../context/slices/authSlice', () => ({
  selectActiveUser: vi.fn(),
}));
vi.mock('../../../context/slices/alertSlice', () => ({addAlert: vi.fn()}));
vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {getSpec: () => uiSpecification},
}));
vi.mock('../../../utils/customHooks', () => ({
  invalidateProjectHydration: vi.fn(),
  invalidateProjectRecordList: vi.fn(),
  useIsAuthorisedTo: () => false,
  useIsRecordDownloadUnderway: () => false,
  usePlanRecordStatusReports: () => new Map(),
  useRecordList: () => ({
    allRecords: [],
    myRecords: [],
    otherRecords: [],
    isLoading: false,
    canReadAllRecords: true,
  }),
}));
vi.mock('../../../utils/apiHooks/notebooks', () => ({
  useRecordAudit: () => ({data: undefined}),
}));
vi.mock('../../../utils/database', () => ({localGetDataDb: () => ({})}));
vi.mock('.', () => ({default: () => <div>default notebook view</div>}));
vi.mock('./settings', () => ({default: () => null}));
vi.mock('./MetadataDisplay', () => ({MetadataDisplayComponent: () => null}));
vi.mock('./OverviewMap', () => ({OverviewMap: () => null}));

const plans = [
  {planId: 'field', planType: 'Counted', label: 'Field'},
  {planId: 'lab', planType: 'Counted', label: 'Lab'},
];

const project = {
  projectId: 'proj',
  serverId: 'srv',
  name: 'Two plans',
  status: ProjectStatus.OPEN,
  isActivated: true,
  uiSpecificationId: 'spec',
  uiDefinition: {plans} as unknown as NotebookDefinition,
} as Project;

const renderNotebook = (params: {planId?: string; tab?: string}) => {
  routeParams.current = params;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotebookView project={project} />
    </QueryClientProvider>
  );
};

const notebookRoute = (next: {planId?: string; tab?: string}) =>
  ROUTES.getNotebookRoute({serverId: 'srv', projectId: 'proj', ...next});

beforeEach(() => navigate.mockClear());
afterEach(() => cleanup());

describe('NotebookView navigation', () => {
  it('replaces the notebook entry when a plan is chosen', async () => {
    renderNotebook({});
    await userEvent.click(screen.getByRole('button', {name: 'Lab'}));
    expect(navigate).toHaveBeenCalledWith(notebookRoute({planId: 'lab'}), {
      replace: true,
    });
  });

  it('replaces the notebook entry when a tab is shown', async () => {
    renderNotebook({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'show a tab'}));
    expect(navigate).toHaveBeenCalledWith(
      notebookRoute({planId: 'lab', tab: 'all-records'}),
      {replace: true}
    );
  });

  it('replaces the notebook entry when the plan is changed', async () => {
    renderNotebook({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'Change plan'}));
    expect(navigate).toHaveBeenCalledWith(notebookRoute({}), {replace: true});
  });

  it('replaces on every move within the notebook, not only the first', async () => {
    renderNotebook({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'show a tab'}));
    await userEvent.click(screen.getByRole('button', {name: 'Change plan'}));
    for (const call of navigate.mock.calls) {
      expect(call[1]).toEqual({replace: true});
    }
  });
});
