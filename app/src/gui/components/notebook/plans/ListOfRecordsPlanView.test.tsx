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

/** One record of the plan's form, claimed by the named plan or by nothing. */
const record = (recordId: string, planId?: string): MinimalRecordMetadata =>
  ({
    recordId,
    type: 'Site',
    planReference: planId && planReferenceFor({planId, reference: 'site-1'}),
  }) as MinimalRecordMetadata;

const renderView = (allRecords: MinimalRecordMetadata[]) =>
  render(
    <ListOfRecordsPlanView
      {...({
        project: {},
        plan,
        tab: 'all-records',
        uiSpecification: {viewsets: {}, visible_types: []},
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

describe('ListOfRecordsPlanView with a second plan on the same form', () => {
  it('lists only the records this plan claims', () => {
    renderView([record('mine', 'field'), record('theirs', 'lab')]);
    expect(screen.getByTestId('rows')).toHaveTextContent('mine');
    expect(screen.getByTestId('rows')).not.toHaveTextContent('theirs');
  });

  it('leaves an unclaimed record out of the list', () => {
    renderView([record('unclaimed')]);
    expect(screen.getByTestId('rows')).toBeEmptyDOMElement();
  });
});
