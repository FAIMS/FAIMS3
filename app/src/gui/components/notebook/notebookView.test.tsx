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
import {addAlert} from '../../../context/slices/alertSlice';
import {NotebookView} from './notebookView';

const {
  navigate,
  routeParams,
  allRecords,
  plotAll,
  queries,
  authorised,
  engine,
  childField,
} = vi.hoisted(() => ({
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
  // Whether the view asks the map for the whole notebook rather than its plan's
  plotAll: {current: false},
  // Every search the record list was asked for, newest last
  queries: {current: [] as string[]},
  // Whether the user may add records; createChildRecord refuses without it
  authorised: {current: false},
  // What the fake data engine was asked to write, and what it holds already
  engine: {
    updates: [] as Array<Record<string, {data: unknown}>>,
    modes: [] as string[],
    existing: undefined as unknown,
    // Whether writing the parent's link fails after the child is written
    failLink: false,
  },
  // The parent field the mock view's button hangs its child off
  childField: {current: 'many-layers'},
}));

vi.mock('@faims3/data-model', async () => {
  const actual = await vi.importActual<object>('@faims3/data-model');
  return {
    ...actual,
    DataEngine: class {
      form = {
        createRecord: async () => ({record: {_id: 'child-1'}}),
        getExistingFormData: async () => ({
          revisionId: 'rev-1',
          data: {[childField.current]: {data: engine.existing}},
        }),
        createRevision: async () => {
          if (engine.failLink) throw new Error('link failed');
          return {_id: 'rev-2'};
        },
        updateRevision: async ({
          update,
          mode,
        }: {
          update: Record<string, {data: unknown}>;
          mode: string;
        }) => {
          engine.updates.push(update);
          engine.modes.push(mode);
        },
      };
    },
  };
});

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
          'button',
          {onClick: () => props.actions.setQuery('needle')},
          'search'
        ),
        React.createElement(
          'button',
          {
            onClick: () =>
              props.actions.createChildRecord({
                formType: 'Density',
                parentRecordId: 'parent-1',
                parentFieldId: childField.current,
              }),
          },
          'add a child'
        ),
        React.createElement(
          'span',
          {'data-testid': 'view-tab'},
          props.tab.current ?? 'none'
        ),
        React.createElement(
          'span',
          {'data-testid': 'editable-records'},
          props.records.notebookRecords
            .filter((record: MinimalRecordMetadata) =>
              props.actions.canEditRecord(record)
            )
            .map((record: MinimalRecordMetadata) => record.recordId)
            .join(' ')
        ),
        React.createElement(
          'span',
          {'data-testid': 'handed-records'},
          props.records.planRecords
            .map((record: MinimalRecordMetadata) => record.recordId)
            .join(' ')
        ),
        React.createElement(
          'span',
          {'data-testid': 'notebook-records'},
          props.records.notebookRecords
            .map((record: MinimalRecordMetadata) => record.recordId)
            .join(' ')
        ),
        React.createElement(props.components.OverviewMap, {
          records: plotAll.current ? props.records.notebookRecords : undefined,
        })
      ),
  };
});

const relatedField = (multiple: boolean) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'RelatedRecordSelector',
  'component-parameters': {related_type: 'Density', multiple},
});

const uiSpecification = {
  viewsets: {},
  views: {},
  fields: {
    'many-layers': relatedField(true),
    'single-test': relatedField(false),
  },
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
  useIsAuthorisedTo: () => authorised.current,
  useIsRecordDownloadUnderway: () => false,
  usePlanRecordStatusReports: () => new Map(),
  // Records the query it was asked for, which is what filters the whole notebook
  useRecordList: ({query}: {query: string}) => {
    queries.current.push(query);
    return {
      allRecords: allRecords.current,
      myRecords: [],
      otherRecords: [],
      isLoading: false,
      canReadAllRecords: true,
    };
  },
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

// The survey's own state, which a closed survey takes out of every write
const projectStatus = {current: ProjectStatus.OPEN};

const project = {
  projectId: 'proj',
  serverId: 'srv',
  name: 'Two plans',
  get status() {
    return projectStatus.current;
  },
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
  const {rerender} = render(
    <QueryClientProvider client={new QueryClient()}>
      <NotebookRouteProvider>
        <NotebookViewTabProvider>
          <NotebookView project={project} />
        </NotebookViewTabProvider>
      </NotebookRouteProvider>
    </QueryClientProvider>
  );
  return {rerender};
};

const notebookRoute = (next: {planId?: string}) =>
  ROUTES.getNotebookRoute({serverId: 'srv', projectId: 'proj', ...next});

beforeEach(() => {
  navigate.mockClear();
  allRecords.current = [];
  plotAll.current = false;
  queries.current = [];
  authorised.current = false;
  engine.updates = [];
  engine.modes = [];
  engine.existing = undefined;
  engine.failLink = false;
  childField.current = 'many-layers';
  projectStatus.current = ProjectStatus.OPEN;
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

describe('NotebookView canEditRecord', () => {
  it('lets a view edit a record the user is authorised for', () => {
    authorised.current = true;
    allRecords.current = [{recordId: 'r1', createdBy: 'testuser'}];
    renderNotebook({planId: 'field'});
    expect(screen.getByTestId('editable-records')).toHaveTextContent('r1');
  });

  it('edits nothing while the survey is closed', () => {
    // A closed survey takes no writes, whoever the user is.
    authorised.current = true;
    projectStatus.current = ProjectStatus.CLOSED;
    allRecords.current = [{recordId: 'r1', createdBy: 'testuser'}];
    renderNotebook({planId: 'field'});
    expect(screen.getByTestId('editable-records')).toHaveTextContent('');
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

  // A plan that processes rather than collects claims nothing, so the scoped
  // list is not the one it works from.
  it('hands a plan view the whole notebook beside the records it claims', () => {
    allRecords.current = [record('mine', 'lab'), record('theirs', 'field')];
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('handed-records')).toHaveTextContent('mine');
    expect(screen.getByTestId('notebook-records')).toHaveTextContent(
      'mine theirs'
    );
  });

  it('drops the search when the plan changes', async () => {
    const {rerender} = renderNotebook({planId: 'lab'});
    await userEvent.click(screen.getByRole('button', {name: 'search'}));
    expect(queries.current.at(-1)).toBe('needle');

    // The route is what changes the plan, so the view is not remounted and its
    // search would otherwise thin what the next plan sees
    routeParams.current = {...routeParams.current, planId: 'field'};
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NotebookRouteProvider>
          <NotebookViewTabProvider>
            <NotebookView project={project} />
          </NotebookViewTabProvider>
        </NotebookRouteProvider>
      </QueryClientProvider>
    );
    expect(queries.current.at(-1)).toBe('');
  });

  it('lets a view plot records beyond the ones its plan claims', () => {
    allRecords.current = [record('mine', 'lab'), record('theirs', 'field')];
    plotAll.current = true;
    renderNotebook({planId: 'lab'});
    expect(screen.getByTestId('plotted-records')).toHaveTextContent(
      'mine theirs'
    );
  });
});

describe('NotebookView createChildRecord', () => {
  /** Render, click the mock view's child button, and return what was written. */
  const addChild = async (fieldId: string, existing?: unknown) => {
    authorised.current = true;
    childField.current = fieldId;
    engine.existing = existing;
    // The link is written onto the parent, so the parent has to be a record
    // this user can see and edit
    allRecords.current = [{recordId: 'parent-1', createdBy: 'testuser'}];
    renderNotebook({planId: 'field'});
    await userEvent.click(screen.getByText('add a child'));
    return engine.updates[0]?.[fieldId]?.data;
  };

  it('appends to a field that holds several links', async () => {
    const written = await addChild('many-layers', [
      {
        record_id: 'child-0',
        relation_type_vocabPair: ['has child', 'is child of'],
      },
    ]);
    expect(written).toEqual([
      {
        record_id: 'child-0',
        relation_type_vocabPair: ['has child', 'is child of'],
      },
      {
        record_id: 'child-1',
        relation_type_vocabPair: ['has child', 'is child of'],
      },
    ]);
  });

  it('writes the link through a new revision, which any edited record needs', async () => {
    // The head revision of a record with history already has a parent, and the
    // 'new' mode refuses that, so the link never lands.
    await addChild('many-layers');
    expect(engine.modes).toEqual(['parent']);
  });

  it('writes one link, not a list of one, to a single-link field', async () => {
    // A list in a single-link field leaves a value the parent's own form
    // cannot read back, so the record looks unlinked wherever it is opened.
    const written = await addChild('single-test');
    expect(written).toEqual({
      record_id: 'child-1',
      relation_type_vocabPair: ['has child', 'is child of'],
    });
  });

  it('keeps a link stored as one bare entry rather than a list', async () => {
    // A related-record value is legitimately a list or a single entry, so
    // reading one entry as none would drop the link it holds.
    const written = await addChild('many-layers', {
      record_id: 'child-0',
      relation_type_vocabPair: ['has child', 'is child of'],
    });
    expect(written).toEqual([
      {
        record_id: 'child-0',
        relation_type_vocabPair: ['has child', 'is child of'],
      },
      {
        record_id: 'child-1',
        relation_type_vocabPair: ['has child', 'is child of'],
      },
    ]);
  });

  it('says the record was created when only the link failed', async () => {
    // The child is written first, so a failure after it leaves a record that
    // exists but is not listed on its parent; saying it was not created sends
    // the user looking for something that is there.
    engine.failLink = true;
    authorised.current = true;
    allRecords.current = [{recordId: 'parent-1', createdBy: 'testuser'}];
    renderNotebook({planId: 'field'});
    await userEvent.click(screen.getByText('add a child'));
    expect(addAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Record was created but could not be linked to its parent',
      })
    );
  });

  it('refuses a parent the user cannot see', async () => {
    authorised.current = true;
    childField.current = 'many-layers';
    allRecords.current = [];
    renderNotebook({planId: 'field'});
    await userEvent.click(screen.getByText('add a child'));
    expect(engine.updates).toEqual([]);
    expect(addAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'You do not have permission to add to that record',
      })
    );
  });

  it('refuses to replace the link a single-link field already holds', async () => {
    // Overwriting drops the parent's side while the old child keeps its parent
    // edge, leaving the two disagreeing about the same relationship.
    const written = await addChild('single-test', {
      record_id: 'child-0',
      relation_type_vocabPair: ['has child', 'is child of'],
    });
    expect(written).toBeUndefined();
    expect(addAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Record was created but could not be linked to its parent',
      })
    );
  });
});
