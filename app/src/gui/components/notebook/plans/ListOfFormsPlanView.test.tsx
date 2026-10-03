import '@testing-library/jest-dom';
import {
  LIST_OF_FORMS_PLAN_TYPE,
  MinimalRecordMetadata,
  RegisteredPlan,
} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {NotebookViewComponentProps} from '../types';
import {ListOfFormsPlanView} from './ListOfFormsPlanView';

// The table stands in for its rows and forms, so the test reads what the
// view hands it
vi.mock('../record_table', () => ({
  RecordsTable: ({
    rows,
    formTypes,
  }: {
    rows: MinimalRecordMetadata[];
    formTypes: string[];
  }) => (
    <div data-testid="rows" data-forms={formTypes.join(' ')}>
      {rows.map(row => row.recordId).join(' ')}
    </div>
  ),
}));

// The buttons reach into app state; the test reads only what they are handed
vi.mock('../add_record_by_type', () => ({
  default: ({
    formTypes,
    planReference,
  }: {
    formTypes: string[];
    planReference?: string;
  }) => (
    <div
      data-testid="add"
      data-forms={formTypes.join(' ')}
      data-plan={planReference}
    />
  ),
}));

vi.mock('../PushOnlySyncBanner', () => ({default: () => null}));

// Pulls in the redux store, which the test environment cannot load
vi.mock('../../workspace/notebooks', () => ({DE_ACTIVATE_VERB: 'Deactivate'}));

const plan = {
  planId: 'calibration',
  planType: LIST_OF_FORMS_PLAN_TYPE,
  label: 'Calibration',
  formTypes: ['Calibration'],
} as unknown as RegisteredPlan;

/** One notebook record of the given form, claimed by no plan. */
const record = (recordId: string, type: string): MinimalRecordMetadata =>
  ({recordId, type}) as MinimalRecordMetadata;

const renderView = (
  myRecords: MinimalRecordMetadata[],
  currentTab = 'my-records'
) =>
  render(
    <ListOfFormsPlanView
      {...({
        project: {},
        plan,
        tab: {current: currentTab, select: vi.fn()},
        uiSpecification: {
          viewsets: {
            Calibration: {label: 'Calibration'},
            Site: {label: 'Site'},
          },
          visible_types: ['Site'],
        },
        records: {
          planRecords: [],
          notebookRecords: myRecords,
          myRecords,
          otherRecords: [],
          syncStatus: {status: {}, recordHashes: {}},
        },
        actions: {
          setQuery: vi.fn(),
          refreshRecordList: vi.fn(),
          createRecord: vi.fn(),
          navigateToRecord: vi.fn(),
        },
        status: {
          isLoading: false,
          isAllowedToAddRecords: true,
          canReadAllRecords: true,
          isDownloadingRecords: false,
        },
        components: {
          NotebookSettings: () => null,
          MetadataDisplayComponent: () => null,
          OverviewMap: () => null,
        },
      } as unknown as NotebookViewComponentProps)}
    />
  );

describe('ListOfFormsPlanView', () => {
  it("lists the notebook's records of the plan's forms, whichever plan made them", () => {
    renderView([record('cal-1', 'Calibration'), record('site-1', 'Site')]);
    const rows = screen.getByTestId('rows');
    expect(rows).toHaveTextContent('cal-1');
    expect(rows).not.toHaveTextContent('site-1');
    expect(rows).toHaveAttribute('data-forms', 'Calibration');
  });

  it("offers the plan's forms and claims the records they create", () => {
    renderView([]);
    const add = screen.getByTestId('add');
    expect(add).toHaveAttribute('data-forms', 'Calibration');
    expect(add).toHaveAttribute('data-plan', 'calibration');
  });

  it('names the records after the form when the plan has one', () => {
    renderView([record('cal-1', 'Calibration')]);
    expect(
      screen.getByRole('tab', {name: 'My Calibrations (1)'})
    ).toBeDefined();
  });

  it('names the plan, which is what a user has seen', () => {
    renderView([]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Calibration: create and browse Calibration records'
    );
  });
});
