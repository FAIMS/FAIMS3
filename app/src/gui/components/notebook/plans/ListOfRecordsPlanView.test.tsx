import '@testing-library/jest-dom';
import {
  LIST_OF_RECORDS_PLAN_TYPE,
  MinimalRecordMetadata,
  planReferenceFor,
  RegisteredPlan,
} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {NotebookViewComponentProps} from '../types';
import {ListOfRecordsPlanView} from './ListOfRecordsPlanView';

// The table stands in for its rows, so the test reads what the plan hands it
vi.mock('../record_table', () => ({
  RecordsTable: ({rows}: {rows: MinimalRecordMetadata[]}) => (
    <div data-testid="rows">{rows.map(row => row.recordId).join(' ')}</div>
  ),
}));

const plan = {
  planId: 'field',
  planType: LIST_OF_RECORDS_PLAN_TYPE,
  label: 'Field',
  formType: 'Site',
  allowExtraRecords: false,
  records: {'site-1': {name: 'Site 1'}},
} as unknown as RegisteredPlan;

/**
 * One record of the plan's form, as the plan-scoped list hands it over, against
 * the named planned entry or against none.
 */
const record = (recordId: string, reference?: string): MinimalRecordMetadata =>
  ({
    recordId,
    type: 'Site',
    planReference:
      reference && planReferenceFor({planId: plan.planId, reference}),
  }) as MinimalRecordMetadata;

const renderView = (allRecords: MinimalRecordMetadata[], tab = 'collected') =>
  render(
    <ListOfRecordsPlanView
      {...({
        project: {},
        plan,
        tab,
        uiSpecification: {viewsets: {Site: {label: 'Site'}}, visible_types: []},
        records: {allRecords, syncStatus: {status: {}, recordHashes: {}}},
        actions: {
          setTab: vi.fn(),
          setQuery: vi.fn(),
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

describe('ListOfRecordsPlanView', () => {
  it('lists the records it is handed', () => {
    renderView([record('mine', 'site-1'), record('mine-too')]);
    expect(screen.getByTestId('rows')).toHaveTextContent('mine mine-too');
  });

  it('shows a planned entry as created once a record references it', () => {
    renderView([record('mine', 'site-1')], 'planned');
    expect(screen.getByRole('button', {name: 'Edit Record'})).toBeDefined();
  });

  it('offers to create a planned entry no record references', () => {
    renderView([record('mine')], 'planned');
    expect(screen.getByRole('button', {name: 'Create Record'})).toBeDefined();
  });

  it("names the records after the plan's own form", () => {
    renderView([]);
    expect(screen.getByRole('tab', {name: 'Planned Sites'})).toBeDefined();
  });

  it('names the plan, which is what tells two plans on one form apart', () => {
    renderView([]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Field: collect Site records'
    );
    expect(screen.getByRole('tablist', {name: 'Field tabs'})).toBeDefined();
  });
});
