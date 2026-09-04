import '@testing-library/jest-dom';
import {
  MinimalRecordMetadata,
  NotebookDefinition,
  planReferenceFor,
  ProjectStatus,
} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as ROUTES from '../../../constants/routes';
import {NotebookRouteProvider} from '../../../context/notebookRoute';
import {NotebookViewTabProvider} from '../../../context/notebookViewTab';
import {Project} from '../../../context/slices/projectSlice';
import {NotebookView} from './notebookView';

const {navigate, routeParams, allRecords} = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {
    current: {} as {
      serverId?: string;
      projectId?: string;
      planId?: string;
    },
  },
  allRecords: {
    current: [] as Array<{recordId: string; planReference?: string}>,
  },
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
  useParams: () => routeParams.current,
}));

// Every plan gets a view, which reports the tab it is on and the records it
// was handed, which are the two things the props contract promises it
vi.mock('./plans', async () => {
  const actual = await vi.importActual<object>('./plans');
  const React = await import('react');
  return {
    ...actual,
    getNotebookView: () => (props: any) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {onClick: () => props.tab.select('all-records')},
          'show a tab'
        ),
        React.createElement(
          'span',
          {'data-testid': 'view-tab'},
          props.tab.current ?? 'none'
        ),
        React.createElement(
          'span',
          {'data-testid': 'handed-records'},
          props.records.planRecords
            .map((record: MinimalRecordMetadata) => record.recordId)
            .join(' ')
        ),
        React.createElement(props.components.OverviewMap)
      ),
  };
});

const uiSpecification = {
  viewsets: {},
  views: {},
  fields: {},
  visible_types: [],
  settings: {showQrCodeButton: false},
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
    allRecords: allRecords.current,
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
// Reports the records it plots, so the map and the lists can be held to one answer
vi.mock('./OverviewMap', () => ({
  OverviewMap: ({
    records,
  }: {
    records: {allRecords: MinimalRecordMetadata[]};
  }) => (
    <span data-testid="plotted-records">
      {records.allRecords.map(record => record.recordId).join(' ')}
    </span>
  ),
}));

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

/**
 * One record, claimed by the named plan or by nothing. A reference qualifies
 * the claim, as a plan whose records are individually planned mints it.
 */
const record = (recordId: string, planId?: string, reference?: string) => ({
  recordId,
  planReference: planId && planReferenceFor({planId, reference}),
});

const renderNotebook = (params: {planId?: string}) => {
  // The notebook's own ids come from the route, as they do in the app
  routeParams.current = {serverId: 'srv', projectId: 'proj', ...params};
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotebookRouteProvider>
        <NotebookViewTabProvider>
          <NotebookView project={project} />
        </NotebookViewTabProvider>
      </NotebookRouteProvider>
    </QueryClientProvider>
  );
};

const notebookRoute = (next: {planId?: string}) =>
  ROUTES.getNotebookRoute({serverId: 'srv', projectId: 'proj', ...next});

beforeEach(() => {
  navigate.mockClear();
  allRecords.current = [];
});
afterEach(() => cleanup());

describe('NotebookView navigation', () => {
  it('replaces the notebook entry when a plan is chosen', async () => {
    renderNotebook({});
    await userEvent.click(screen.getByRole('button', {name: 'Lab'}));
    expect(navigate).toHaveBeenCalledWith(notebookRoute({planId: 'lab'}), {
      replace: true,
    });
  });

  it('shows the tab the view selects without touching the route', async () => {
    renderNotebook({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'show a tab'}));
    expect(screen.getByTestId('view-tab')).toHaveTextContent('all-records');
    expect(navigate).not.toHaveBeenCalled();
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

describe('NotebookView record scoping', () => {
  it('hands a plan view only the records that plan claims', () => {
    allRecords.current = [record('mine', 'lab'), record('theirs', 'field')];
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('handed-records')).toHaveTextContent('mine');
    expect(screen.getByTestId('handed-records')).not.toHaveTextContent(
      'theirs'
    );
  });

  it('leaves a record no plan claims out', () => {
    allRecords.current = [record('unclaimed')];
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('handed-records')).toBeEmptyDOMElement();
  });

  it('claims a record whose reference qualifies the plan id', () => {
    allRecords.current = [
      record('mine', 'lab', 'site-1'),
      record('theirs', 'field', 'site-1'),
    ];
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('handed-records')).toHaveTextContent('mine');
    expect(screen.getByTestId('handed-records')).not.toHaveTextContent(
      'theirs'
    );
  });

  it('plots on the map what it hands the view, and nothing more', () => {
    allRecords.current = [record('mine', 'lab'), record('theirs', 'field')];
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('plotted-records')).toHaveTextContent('mine');
    expect(screen.getByTestId('plotted-records')).not.toHaveTextContent(
      'theirs'
    );
  });
});
