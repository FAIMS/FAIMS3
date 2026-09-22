import '@testing-library/jest-dom';
import {
  MAP_COLLECTION_PLAN_TYPE,
  MinimalRecordMetadata,
  planReferenceFor,
  RegisteredPlan,
} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {NotebookViewComponentProps} from '../types';
import {MapCollectionPlanView} from './MapCollectionPlanView';
import type {PlanRecordMapProps} from './PlanRecordMap';

// The table stands in for its rows, so the test reads what the plan hands it
vi.mock('../record_table', () => ({
  RecordsTable: ({rows}: {rows: MinimalRecordMetadata[]}) => (
    <div data-testid="rows">{rows.map(row => row.recordId).join(' ')}</div>
  ),
}));
// The map stands in for its features and offers the same actions
vi.mock('./PlanRecordMap', () => ({
  PlanRecordMap: ({features, onCreate, onOpen}: PlanRecordMapProps) => (
    <div data-testid="map">
      {features.features.map((f, i) => (
        <button
          key={i}
          data-testid={`feature-${f.properties.reference}-${i}`}
          data-created={String(f.properties.created)}
          onClick={() =>
            f.properties.created
              ? onOpen(f.properties.planReference)
              : onCreate(f.properties.reference)
          }
        />
      ))}
    </div>
  ),
}));
vi.mock('../add_record_by_type', () => ({
  default: () => <div data-testid="add-buttons" />,
}));
vi.mock('../PushOnlySyncBanner', () => ({default: () => null}));
// Pulls in the redux store, which the test environment cannot load
vi.mock('../../workspace/notebooks', () => ({DE_ACTIVATE_VERB: 'Deactivate'}));

const spatial = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151, -33]},
      properties: null,
    },
  ],
};

const plan = {
  planId: 'sites',
  planType: MAP_COLLECTION_PLAN_TYPE,
  label: 'Sites',
  formType: 'Site',
  spatialFieldId: 'Location',
  recordFields: [{fieldId: 'Name', required: true}],
  allowExtraRecords: false,
  records: {
    'planned-1': {fields: {Name: 'Site 1'}, spatial},
    'planned-2': {fields: {Name: 'Site 2'}, spatial},
  },
} as unknown as RegisteredPlan;

const record = (
  recordId: string,
  reference?: string,
  type = 'Site'
): MinimalRecordMetadata =>
  ({
    recordId,
    type,
    planReference:
      reference && planReferenceFor({planId: plan.planId, reference}),
  }) as MinimalRecordMetadata;

const renderView = ({
  planRecords = [],
  myRecords = [],
  otherRecords = [],
  currentTab = 'record-map',
  planOverride = plan,
  spatialComponent = 'MapFormField',
  statusOverrides = {},
}: {
  planRecords?: MinimalRecordMetadata[];
  myRecords?: MinimalRecordMetadata[];
  otherRecords?: MinimalRecordMetadata[];
  currentTab?: string;
  planOverride?: RegisteredPlan;
  spatialComponent?: string;
  /** What the user may see of the notebook's records, when it matters */
  statusOverrides?: {
    canReadAllRecords?: boolean;
    isDownloadingRecords?: boolean;
    isAllowedToAddRecords?: boolean;
  };
} = {}) => {
  const createRecord = vi.fn();
  const navigateToRecord = vi.fn();
  render(
    <MapCollectionPlanView
      {...({
        project: {},
        plan: planOverride,
        tab: {current: currentTab, select: vi.fn()},
        uiSpecification: {
          viewsets: {Site: {label: 'Site'}},
          fields: {Location: {'component-name': spatialComponent}},
          visible_types: [],
        },
        records: {
          planRecords,
          myRecords,
          otherRecords,
          notebookRecords: [...myRecords, ...otherRecords],
          syncStatus: {status: {}, recordHashes: {}},
        },
        actions: {
          setQuery: vi.fn(),
          refreshRecordList: vi.fn(),
          createRecord,
          navigateToRecord,
        },
        status: {
          isLoading: false,
          isAllowedToAddRecords: true,
          canReadAllRecords: true,
          isDownloadingRecords: false,
          ...statusOverrides,
        },
        components: {
          NotebookSettings: () => null,
          MetadataDisplayComponent: () => null,
          OverviewMap: () => <div data-testid="overview-map" />,
        },
      } as unknown as NotebookViewComponentProps)}
    />
  );
  return {createRecord, navigateToRecord};
};

describe('MapCollectionPlanView', () => {
  it('carries the survey tabs beside its own', () => {
    renderView({otherRecords: [record('theirs')]});
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Record Map',
      'Planned Sites (2)',
      'My Sites (0)',
      'Other Sites (1)',
      'Overview Map',
      'Details',
      'Settings',
    ]);
  });

  it('marks a planned feature created once a record claims it', () => {
    renderView({planRecords: [record('mine', 'planned-1')]});
    expect(screen.getByTestId('feature-planned-1-0')).toHaveAttribute(
      'data-created',
      'true'
    );
    expect(screen.getByTestId('feature-planned-2-1')).toHaveAttribute(
      'data-created',
      'false'
    );
  });

  it('creates a pending entry with its fields and geometry on the spatial field', () => {
    const {createRecord} = renderView();
    fireEvent.click(screen.getByTestId('feature-planned-1-0'));
    expect(createRecord).toHaveBeenCalledWith(
      'Site',
      {Name: 'Site 1', Location: spatial},
      'sites/planned-1'
    );
  });

  it('writes a single point feature when the spatial field is a GPS point', () => {
    const {createRecord} = renderView({spatialComponent: 'TakePoint'});
    fireEvent.click(screen.getByTestId('feature-planned-1-0'));
    const initial = createRecord.mock.calls[0][1];
    expect(initial.Location).toMatchObject({
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151, -33]},
      properties: {accuracy: 0},
    });
  });

  it('opens the record of a created entry', () => {
    const mine = record('mine', 'planned-1');
    const {navigateToRecord} = renderView({planRecords: [mine]});
    fireEvent.click(screen.getByTestId('feature-planned-1-0'));
    expect(navigateToRecord).toHaveBeenCalledWith(mine);
  });

  it('lists the planned entries with their state', () => {
    const {createRecord} = renderView({
      planRecords: [record('mine', 'planned-1')],
      currentTab: 'planned-records',
    });
    expect(screen.getByRole('button', {name: 'View Record'})).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: 'Create Record'}));
    expect(createRecord).toHaveBeenCalledWith(
      'Site',
      {Name: 'Site 2', Location: spatial},
      'sites/planned-2'
    );
  });

  it('labels a planned entry with its pre-filled fields and its geometry', () => {
    renderView({
      currentTab: 'planned-records',
      planOverride: {
        ...plan,
        records: {
          ...plan.records,
          'planned-2': {
            fields: {Name: 'Site 2'},
            // An entry carries more than one spatial reference as more features
            spatial: {
              type: 'FeatureCollection',
              features: [...spatial.features, ...spatial.features],
            },
          },
        },
      } as unknown as RegisteredPlan,
    });
    expect(screen.getByTestId('planned-entry-planned-1')).toHaveTextContent(
      'Name: Site 1'
    );
    expect(screen.getByTestId('planned-entry-planned-1')).toHaveTextContent(
      'Geometry: Point'
    );
    expect(screen.getByTestId('planned-entry-planned-2')).toHaveTextContent(
      'Geometry: Point × 2'
    );
  });

  it('warns that a pending entry may already have a record the user cannot read', () => {
    renderView({statusOverrides: {canReadAllRecords: false}});
    expect(screen.getByText(/not visible to you yet/)).toBeDefined();
  });

  it('warns on the planned list while records are still downloading', () => {
    renderView({
      currentTab: 'planned-records',
      statusOverrides: {isDownloadingRecords: true},
    });
    expect(screen.getByText(/not visible to you yet/)).toBeDefined();
  });

  it('does not warn once every record of the plan is visible', () => {
    renderView();
    expect(screen.queryByText(/not visible to you yet/)).toBeNull();
  });

  it("lists the user's records of the plan's form, whichever plan made them", () => {
    renderView({
      myRecords: [record('mine'), record('elsewhere', undefined, 'Other')],
      currentTab: 'my-records',
    });
    expect(screen.getByTestId('rows')).toHaveTextContent('mine');
    expect(screen.getByTestId('rows')).not.toHaveTextContent('elsewhere');
  });

  it('offers extra records only when the plan allows them', () => {
    renderView();
    expect(screen.queryByTestId('add-buttons')).toBeNull();
  });

  it('offers extra records when the plan allows them', () => {
    renderView({
      planOverride: {...plan, allowExtraRecords: true} as RegisteredPlan,
    });
    expect(screen.getByTestId('add-buttons')).toBeDefined();
  });

  it('names the plan and its progress', () => {
    renderView({planRecords: [record('mine', 'planned-1')]});
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sites: collect Site records at 2 planned locations (1 created)'
    );
  });
});
