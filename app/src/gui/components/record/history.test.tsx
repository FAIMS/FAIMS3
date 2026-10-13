// SPDX-License-Identifier: Apache-2.0
import {
  RecursiveRecordHistory,
  RevisionHistoryEntry,
  UiSpecModel,
} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../../../utils/customHooks', () => ({
  buildRecordHistoryKey: ({
    projectId,
    recordId,
  }: {
    projectId: string;
    recordId: string;
  }) => ['recordhydration', projectId, recordId, 'recordHistory'],
}));

import testTheme from '../../themes/fieldmark';
import {RecordHistoryTimeline} from './history';
import {
  flattenRecordHistory,
  formatHistoryEventDate,
  formatHistoryEventTime,
  formatHistoryGroupLabel,
  getChangedFieldIds,
  getHistoryEventKind,
  getHistoryEventSubtitle,
  getHistoryEventTitle,
  groupHistoryByDate,
  type FlattenedHistoryEvent,
} from './historyUtils';

const uiSpec = {
  fields: {
    site_name: {
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'component-parameters': {label: 'Site name', name: 'site_name'},
    },
    contact_email: {
      'component-namespace': 'faims-custom',
      'component-name': 'Email',
      'component-parameters': {label: 'Contact email', name: 'contact_email'},
    },
    child_sites: {
      'component-namespace': 'faims-custom',
      'component-name': 'RelatedRecordSelector',
      'component-parameters': {label: 'Child sites', name: 'child_sites'},
    },
  },
  views: {
    'site-details': {label: 'Site details', fields: ['site_name']},
    'contact-section': {
      label: 'Email address',
      fields: ['contact_email', 'child_sites'],
    },
  },
  viewsets: {
    Site: {label: 'Site record', views: ['site-details', 'contact-section']},
  },
  visible_types: ['Site'],
} as unknown as UiSpecModel;

function entry(
  overrides: Partial<RevisionHistoryEntry> &
    Pick<RevisionHistoryEntry, 'revisionId' | 'created' | 'changedFields'>
): RevisionHistoryEntry {
  return {
    createdBy: 'Peter Baker',
    ...overrides,
  };
}

function flatten(
  history: RevisionHistoryEntry[],
  formId = 'Site',
  recordId = 'parent-1'
): FlattenedHistoryEvent[] {
  return history.map(item => ({
    created: item.created,
    entry: item,
    recordId,
    formId,
    hrid: 'Site-1',
  }));
}

describe('historyUtils', () => {
  it('classifies root revisions as created and deleted flags as deleted', () => {
    expect(
      getHistoryEventKind(
        entry({
          revisionId: 'r1',
          created: '2025-10-06T10:00:00.000Z',
          changedFields: {root: ['site_name']},
        })
      )
    ).toBe('created');
    expect(
      getHistoryEventKind(
        entry({
          revisionId: 'r2',
          created: '2025-10-06T11:00:00.000Z',
          changedFields: {r1: ['site_name']},
          deleted: true,
        })
      )
    ).toBe('deleted');
    expect(
      getHistoryEventKind(
        entry({
          revisionId: 'r2',
          created: '2025-10-06T11:00:00.000Z',
          changedFields: {r1: ['site_name']},
        })
      )
    ).toBe('updated');
  });

  it('builds action titles and deduplicates changed field ids', () => {
    const updated = entry({
      revisionId: 'r2',
      created: '2025-10-06T11:00:00.000Z',
      changedFields: {r1: ['site_name', 'contact_email'], r0: ['site_name']},
    });
    expect(getHistoryEventTitle(updated)).toBe('Peter Baker Updated');
    expect(getChangedFieldIds(updated)).toEqual(['site_name', 'contact_email']);
  });

  it('uses the form label for create and update events', () => {
    expect(getHistoryEventSubtitle({uiSpec, formId: 'Site'})).toBe(
      'Site record'
    );
  });

  it('formats dates, times, and relative group headings', () => {
    const now = new Date(2025, 9, 6, 12, 0, 0);
    const today = new Date(2025, 9, 6, 20, 5, 0);
    const yesterday = new Date(2025, 9, 5, 16, 26, 0);
    const earlier = new Date(2025, 8, 30, 11, 42, 0);
    const lastYear = new Date(2024, 8, 30, 11, 42, 0);

    expect(formatHistoryEventDate(today)).toBe('06 October');
    expect(formatHistoryEventTime(today)).toMatch(/8:05\s*pm/);
    expect(formatHistoryGroupLabel(today, now)).toBe('TODAY, 6 OCTOBER');
    expect(formatHistoryGroupLabel(yesterday, now)).toBe(
      'YESTERDAY, 5 OCTOBER'
    );
    expect(formatHistoryGroupLabel(earlier, now)).toBe('30 SEPTEMBER');
    expect(formatHistoryGroupLabel(lastYear, now)).toBe('30 SEPTEMBER 2024');
  });

  it('groups newest-first history by local calendar day', () => {
    const now = new Date(2025, 9, 6, 12, 0, 0);
    const groups = groupHistoryByDate(
      [
        entry({
          revisionId: 'older',
          created: new Date(2025, 9, 5, 16, 26, 0).toISOString(),
          changedFields: {root: ['site_name']},
        }),
        entry({
          revisionId: 'newer',
          created: new Date(2025, 9, 6, 20, 5, 0).toISOString(),
          changedFields: {older: ['contact_email']},
        }),
        entry({
          revisionId: 'also-today',
          created: new Date(2025, 9, 6, 8, 0, 0).toISOString(),
          changedFields: {older: ['site_name']},
        }),
      ],
      now
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe('TODAY, 6 OCTOBER');
    expect(groups[0]?.entries.map(item => item.revisionId)).toEqual([
      'newer',
      'also-today',
    ]);
    expect(groups[1]?.label).toBe('YESTERDAY, 5 OCTOBER');
  });

  it('flattens a parent and child tree into one list, parent entries then children', () => {
    const tree: RecursiveRecordHistory = {
      recordId: 'parent-1',
      hrid: 'Site-1',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'p-update',
          created: '2025-10-06T12:00:00.000Z',
          changedFields: {['p-create']: ['site_name']},
        }),
        entry({
          revisionId: 'p-create',
          created: '2025-10-05T09:00:00.000Z',
          changedFields: {root: ['site_name']},
        }),
      ],
      childFields: [
        {
          fieldId: 'child_sites',
          children: [
            {
              recordId: 'child-1',
              hrid: 'Widget C1',
              formId: 'Site',
              entries: [
                entry({
                  revisionId: 'c-create',
                  created: '2025-10-06T10:00:00.000Z',
                  changedFields: {root: ['contact_email']},
                }),
              ],
              childFields: [],
            },
          ],
        },
      ],
    };

    expect(
      flattenRecordHistory(tree).map(event => event.entry.revisionId)
    ).toEqual(['p-update', 'p-create', 'c-create']);
  });

  it('emits a child linked from two fields once', () => {
    const child: RecursiveRecordHistory = {
      recordId: 'child-1',
      hrid: 'Widget C1',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'c-create',
          created: '2025-10-06T10:00:00.000Z',
          changedFields: {root: ['contact_email']},
        }),
      ],
      childFields: [],
    };
    const tree: RecursiveRecordHistory = {
      recordId: 'parent-1',
      hrid: 'Site-1',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'p-create',
          created: '2025-10-05T09:00:00.000Z',
          changedFields: {root: ['site_name']},
        }),
      ],
      childFields: [
        {fieldId: 'photos', children: [child]},
        {fieldId: 'features', children: [child]},
      ],
    };

    const events = flattenRecordHistory(tree);
    expect(events.map(event => event.entry.revisionId)).toEqual([
      'p-create',
      'c-create',
    ]);
    expect(
      events.map(event => `${event.recordId}-${event.entry.revisionId}`)
    ).toEqual(['parent-1-p-create', 'child-1-c-create']);
  });

  it('emits a grandchild reached by two paths once', () => {
    const grandchild: RecursiveRecordHistory = {
      recordId: 'grandchild-1',
      hrid: 'Widget G1',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'g-create',
          created: '2025-10-06T11:00:00.000Z',
          changedFields: {root: ['contact_email']},
        }),
      ],
      childFields: [],
    };
    const left: RecursiveRecordHistory = {
      recordId: 'child-left',
      hrid: 'Widget L',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'l-create',
          created: '2025-10-06T10:00:00.000Z',
          changedFields: {root: ['site_name']},
        }),
      ],
      childFields: [{fieldId: 'child_sites', children: [grandchild]}],
    };
    const right: RecursiveRecordHistory = {
      recordId: 'child-right',
      hrid: 'Widget R',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'r-create',
          created: '2025-10-06T10:30:00.000Z',
          changedFields: {root: ['site_name']},
        }),
      ],
      childFields: [{fieldId: 'child_sites', children: [grandchild]}],
    };
    const tree: RecursiveRecordHistory = {
      recordId: 'parent-1',
      hrid: 'Site-1',
      formId: 'Site',
      entries: [
        entry({
          revisionId: 'p-create',
          created: '2025-10-05T09:00:00.000Z',
          changedFields: {root: ['site_name']},
        }),
      ],
      childFields: [{fieldId: 'child_sites', children: [left, right]}],
    };

    expect(flattenRecordHistory(tree).map(event => event.recordId)).toEqual([
      'parent-1',
      'child-left',
      'grandchild-1',
      'child-right',
    ]);
  });
});

describe('RecordHistoryTimeline', () => {
  const history: RevisionHistoryEntry[] = [
    entry({
      revisionId: 'rev-create',
      created: new Date(2025, 9, 6, 9, 2, 0).toISOString(),
      changedFields: {root: ['site_name', 'contact_email']},
    }),
    entry({
      revisionId: 'rev-update',
      created: new Date(2025, 9, 6, 20, 5, 0).toISOString(),
      changedFields: {['rev-create']: ['contact_email']},
    }),
  ];

  it('renders grouped events with titles, subtitles, and no trailing chevron', () => {
    render(
      <ThemeProvider theme={testTheme}>
        <RecordHistoryTimeline
          events={flatten(history)}
          uiSpec={uiSpec}
          rootRecordId="parent-1"
        />
      </ThemeProvider>
    );

    expect(screen.getAllByText('Peter Baker')).toHaveLength(2);
    expect(screen.getByText(/Created\s+Site record/)).toBeTruthy();
    expect(screen.getByText(/Updated\s+Site record/)).toBeTruthy();
    expect(screen.getByTestId('record-history-icon-created')).toBeTruthy();
    expect(screen.getByTestId('record-history-icon-updated')).toBeTruthy();
    expect(screen.queryByText('2 fields')).toBeNull();
    expect(screen.queryByText('1 field')).toBeNull();
    expect(screen.queryByTestId('NavigateNextIcon')).toBeNull();
  });

  it('opens event details for time and changed fields', async () => {
    const user = userEvent.setup({pointerEventsCheck: 0});
    render(
      <ThemeProvider theme={testTheme}>
        <RecordHistoryTimeline
          events={flatten(history)}
          uiSpec={uiSpec}
          rootRecordId="parent-1"
        />
      </ThemeProvider>
    );

    expect(screen.queryByText('Contact email')).toBeNull();
    await user.click(screen.getAllByLabelText('Event details')[0]!);
    expect(screen.getByText('Contact email')).toBeTruthy();
    expect(screen.getByText(/8:05/)).toBeTruthy();
  });

  it('renders a delete of the viewed record and of a child', () => {
    const deletedChild: FlattenedHistoryEvent = {
      created: new Date(2025, 9, 6, 21, 0, 0).toISOString(),
      recordId: 'child-1',
      formId: 'Site',
      hrid: 'Widget C1',
      entry: entry({
        revisionId: 'rev-child-delete',
        created: new Date(2025, 9, 6, 21, 0, 0).toISOString(),
        changedFields: {['rev-create']: []},
        deleted: true,
      }),
    };
    const deletedRoot: FlattenedHistoryEvent = {
      created: new Date(2025, 9, 6, 21, 30, 0).toISOString(),
      recordId: 'parent-1',
      formId: 'Site',
      hrid: 'Site-1',
      entry: entry({
        revisionId: 'rev-delete',
        created: new Date(2025, 9, 6, 21, 30, 0).toISOString(),
        changedFields: {['rev-update']: []},
        deleted: true,
      }),
    };

    render(
      <ThemeProvider theme={testTheme}>
        <RecordHistoryTimeline
          events={[...flatten(history), deletedChild, deletedRoot]}
          uiSpec={uiSpec}
          rootRecordId="parent-1"
        />
      </ThemeProvider>
    );

    const deletedEvents = screen
      .getAllByTestId('record-history-event')
      .filter(el => el.getAttribute('data-kind') === 'deleted');
    expect(deletedEvents.map(el => el.id)).toEqual([
      'parent-1-rev-delete',
      'child-1-rev-child-delete',
    ]);
    expect(screen.getByText('Child')).toBeTruthy();
    expect(screen.getAllByTestId('record-history-icon-deleted')).toHaveLength(
      2
    );
  });

  it('shows an empty message when there is no history', () => {
    render(
      <ThemeProvider theme={testTheme}>
        <RecordHistoryTimeline events={[]} uiSpec={uiSpec} />
      </ThemeProvider>
    );

    expect(
      screen.getByText('No revision history is available for this record.')
    ).toBeTruthy();
  });
});
