/**
 * The components a notebook view hands to its plan views have to keep their
 * identity while the notebook re-renders. React compares element types by
 * reference, so a component rebuilt on every render is a new type and the
 * whole subtree under it unmounts, losing whatever state it held. The record
 * list polls, so that used to happen every few seconds and closed any dialog
 * the user had open.
 */
import '@testing-library/jest-dom';
import {
  NotebookDefinition,
  ProjectStatus,
  type MinimalRecordMetadata,
} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NotebookRouteProvider} from '../../../context/notebookRoute';
import {NotebookViewTabProvider} from '../../../context/notebookViewTab';
import {Project} from '../../../context/slices/projectSlice';
import {NotebookView} from './notebookView';

const {navigate, routeParams, allRecords, settingsMounts} = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {
    current: {} as {serverId?: string; projectId?: string; planId?: string},
  },
  allRecords: {current: [] as Array<{recordId: string}>},
  // One entry per mount of the settings component, so a remount is visible
  settingsMounts: {current: 0},
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
  useParams: () => routeParams.current,
}));

// The plan view renders the injected settings component and offers a way to
// change the records, which is what the poll does in the running app.
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
          'span',
          {'data-testid': 'handed-records'},
          props.records.notebookRecords
            .map((record: MinimalRecordMetadata) => record.recordId)
            .join(' ')
        ),
        React.createElement(props.components.NotebookSettings)
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
vi.mock('./DefaultNotebookView', () => ({
  default: () => <div>default notebook view</div>,
}));
vi.mock('./MetadataDisplay', () => ({MetadataDisplayComponent: () => null}));
vi.mock('./OverviewMap', () => ({OverviewMap: () => null}));

// Stands in for the settings panel: it counts its mounts and holds the open
// state of a dialog, which is the state a remount destroys.
vi.mock('./settings', async () => {
  const React = await import('react');
  const CountedSettings = () => {
    const [isOpen, setOpen] = React.useState(false);
    React.useEffect(() => {
      settingsMounts.current += 1;
    }, []);
    return React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {onClick: () => setOpen(true)},
        'open dialog'
      ),
      isOpen
        ? React.createElement('span', {'data-testid': 'dialog'}, 'open')
        : null
    );
  };
  return {default: CountedSettings};
});

const plans = [{planId: 'lab', planType: 'Counted', label: 'Lab'}];

const project = {
  projectId: 'proj',
  serverId: 'srv',
  name: 'One plan',
  status: ProjectStatus.OPEN,
  isActivated: true,
  uiSpecificationId: 'spec',
  uiDefinition: {plans} as unknown as NotebookDefinition,
} as Project;

const renderNotebook = () => {
  routeParams.current = {serverId: 'srv', projectId: 'proj', planId: 'lab'};
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotebookRouteProvider>
        <NotebookViewTabProvider>
          <NotebookView project={project} />
        </NotebookViewTabProvider>
      </NotebookRouteProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  navigate.mockClear();
  allRecords.current = [{recordId: 'first'}];
  settingsMounts.current = 0;
});
afterEach(() => cleanup());

describe('components handed to a plan view', () => {
  it('keeps an open dialog open when the record list changes', async () => {
    const {rerender} = renderNotebook();
    await userEvent.click(screen.getByRole('button', {name: 'open dialog'}));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    // What the poll does: the same list arrives as a new array
    allRecords.current = [{recordId: 'first'}, {recordId: 'second'}];
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NotebookRouteProvider>
          <NotebookViewTabProvider>
            <NotebookView project={project} />
          </NotebookViewTabProvider>
        </NotebookRouteProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('handed-records')).toHaveTextContent('second');
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('mounts the settings component once across a record change', async () => {
    const {rerender} = renderNotebook();
    expect(settingsMounts.current).toBe(1);

    allRecords.current = [{recordId: 'first'}, {recordId: 'second'}];
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NotebookRouteProvider>
          <NotebookViewTabProvider>
            <NotebookView project={project} />
          </NotebookViewTabProvider>
        </NotebookRouteProvider>
      </QueryClientProvider>
    );

    expect(settingsMounts.current).toBe(1);
  });
});
