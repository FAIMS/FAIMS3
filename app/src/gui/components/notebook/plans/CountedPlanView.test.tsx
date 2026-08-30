import '@testing-library/jest-dom';
import {
  COUNTED_PLAN_TYPE,
  MinimalRecordMetadata,
  planReferenceFor,
  RegisteredPlan,
} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {NotebookViewComponentProps} from '../types';
import {CountedPlanView} from './CountedPlanView';

// The table stands in for its rows, so the test reads what the plan hands it
vi.mock('../record_table', () => ({
  RecordsTable: ({rows}: {rows: MinimalRecordMetadata[]}) => (
    <div data-testid="rows">{rows.map(row => row.recordId).join(' ')}</div>
  ),
}));
vi.mock('../add_record_by_type', () => ({default: () => null}));

const plan = {
  planId: 'field',
  planType: COUNTED_PLAN_TYPE,
  label: 'Field',
  formType: 'Site',
  numberRequired: 2,
  allowExtraRecords: false,
} as RegisteredPlan;

/** One record of the plan's form, claimed by the named plan or by nothing. */
const record = (recordId: string, planId?: string): MinimalRecordMetadata =>
  ({
    recordId,
    type: 'Site',
    planReference: planId && planReferenceFor({planId}),
  }) as MinimalRecordMetadata;

const renderView = (allRecords: MinimalRecordMetadata[]) =>
  render(
    <CountedPlanView
      {...({
        project: {},
        plan,
        uiSpecification: {viewsets: {Site: {label: 'Site'}}, visible_types: []},
        records: {allRecords, syncStatus: {status: {}, recordHashes: {}}},
        actions: {
          setTab: vi.fn(),
          setQuery: vi.fn(),
          refreshRecordList: vi.fn(),
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

describe('CountedPlanView with a second plan on the same form', () => {
  it('lists only the records this plan claims', () => {
    renderView([record('mine', 'field'), record('theirs', 'lab')]);
    expect(screen.getByTestId('rows')).toHaveTextContent('mine');
    expect(screen.getByTestId('rows')).not.toHaveTextContent('theirs');
  });

  it("does not let another plan's records reach this plan's target", () => {
    renderView([record('theirs', 'lab'), record('also-theirs', 'lab')]);
    expect(screen.queryByText('Target number of records reached.')).toBeNull();
  });

  it('reaches the target on its own records', () => {
    renderView([record('mine', 'field'), record('mine-too', 'field')]);
    expect(
      screen.getByText('Target number of records reached.')
    ).toBeInTheDocument();
  });

  it('leaves an unclaimed record out of the count', () => {
    renderView([record('mine', 'field'), record('unclaimed')]);
    expect(screen.queryByText('Target number of records reached.')).toBeNull();
  });

  it("names the records after the plan's own form", () => {
    renderView([]);
    expect(screen.getByRole('tab', {name: 'Planned Sites'})).toBeDefined();
  });

  it('names the plan, which is what tells two plans on one form apart', () => {
    renderView([]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Field: collect 2 Site records'
    );
    expect(screen.getByRole('tablist', {name: 'Field tabs'})).toBeDefined();
  });
});
