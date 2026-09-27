import '@testing-library/jest-dom/vitest';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useMemo, useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {relatedRecordFieldSpec} from './index';
import {DataEngine} from '@faims3/data-model';

vi.mock('@faims3/data-model', async () => {
  const actual = await vi.importActual<object>('@faims3/data-model');
  return {
    ...actual,
    canDeleteProjectRecord: vi.fn(() => false),
    canEditProjectRecord: vi.fn(() => false),
  };
});

type LinkEntry = {
  record_id: string;
  relation_type_vocabPair: [string, string];
};

const RELATION_PAIR: [string, string] = ['has child', 'is child of'];

const makeLink = (id: string): LinkEntry => ({
  record_id: id,
  relation_type_vocabPair: RELATION_PAIR,
});

const makeHydratedRecord = (id: string) => ({
  hrid: id,
  record: {
    _id: id,
    createdBy: 'user-1',
    deleted: false,
  },
  revision: {
    _id: `rev-${id}`,
    deleted: false,
    relationship: {},
  },
});

function renderRelatedRecordField({
  initialData,
  createRelatedRecord,
  onSetFieldData,
  multiple = true,
  stateValueUndefined = false,
}: {
  initialData: LinkEntry[] | LinkEntry | undefined;
  createRelatedRecord: (args: {
    parentRecordId: string;
    parentFieldId: string;
    createdBy: string;
    parentFieldValue: unknown;
  }) => Promise<{
    record: {_id: string};
    linked: LinkEntry[] | LinkEntry;
  }>;
  onSetFieldData?: (value: unknown) => void;
  multiple?: boolean;
  stateValueUndefined?: boolean;
}) {
  const commit = vi.fn(async () => undefined);
  const toRecord = vi.fn();
  const getHydratedRecord = vi.fn(async ({recordId}: {recordId: string}) =>
    makeHydratedRecord(recordId)
  );

  const dataEngine = {
    uiSpec: {
      viewsets: {
        Sample: {
          label: 'Sample',
          views: [],
        },
      },
    },
    form: {
      createRelatedRecord,
      getHydratedRecords: vi.fn(async () => ({
        records: [],
        hasMore: false,
        nextStartKey: undefined,
      })),
    },
    hydrated: {
      getHydratedRecord,
      updateRevision: vi.fn(async () => undefined),
    },
    deleteRecord: vi.fn(async () => undefined),
  } as unknown as DataEngine;

  const Wrapper = () => {
    const [fieldData, setFieldDataState] =
      useState<typeof initialData>(initialData);
    const queryClient = useMemo(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: {retry: false},
            mutations: {retry: false},
          },
        }),
      []
    );

    return (
      <QueryClientProvider client={queryClient}>
        <relatedRecordFieldSpec.component
          name="samples"
          label="Related"
          required={false}
          helperText={''}
          advancedHelperText={''}
          related_type="Sample"
          relation_type="faims-core::Child"
          multiple={multiple}
          allowLinkToExisting={false}
          fieldId="samples"
          state={
            {
              value: stateValueUndefined ? undefined : {data: fieldData},
              meta: {errors: []},
            } as any
          }
          setFieldData={(nextOrUpdater: unknown) => {
            setFieldDataState(prev => {
              const next =
                typeof nextOrUpdater === 'function'
                  ? (nextOrUpdater as (value: unknown) => unknown)(prev)
                  : nextOrUpdater;
              onSetFieldData?.(next);
              return next as typeof initialData;
            });
          }}
          setFieldAnnotation={vi.fn()}
          addAttachment={vi.fn(async () => 'attachment-id')}
          removeAttachment={vi.fn(async () => undefined)}
          handleBlur={vi.fn()}
          trigger={{commit}}
          config={
            {
              mode: 'full',
              layout: 'inline',
              platform: 'web',
              mapConfig: () => ({}) as any,
              recordId: 'parent-1',
              projectId: 'project-1',
              decodedToken: {globalRoles: [], resourceRoles: []},
              dataEngine: () => dataEngine,
              attachmentEngine: () => ({}) as any,
              recordMode: 'parent',
              navigation: {
                toRecord,
                getToRecordLink: () => '/record',
                navigateToLink: vi.fn(),
                navigateToRecordList: {
                  label: 'Back',
                  navigate: vi.fn(),
                },
                navigateToViewRecord: vi.fn(),
              },
              incrementerService: {} as any,
              appName: 'test-app',
              user: 'user-1',
              trigger: {commit},
            } as any
          }
        />
      </QueryClientProvider>
    );
  };

  render(<Wrapper />);

  return {
    commit,
    toRecord,
    getHydratedRecord,
  };
}

describe('RelatedRecord create flow', () => {
  it('passes existing multiple links as parentFieldValue and preserves them after create', async () => {
    const user = userEvent.setup();
    const existing = makeLink('sample-0');
    const setFieldDataValues: unknown[] = [];

    const createRelatedRecord = vi.fn(async ({parentFieldValue}) => {
      const prev = Array.isArray(parentFieldValue)
        ? (parentFieldValue as LinkEntry[])
        : [];
      const newLink = makeLink('sample-1');
      return {
        record: {_id: newLink.record_id},
        linked: [...prev, newLink],
      };
    });

    const {commit, toRecord} = renderRelatedRecordField({
      initialData: [existing],
      createRelatedRecord,
      onSetFieldData: value => setFieldDataValues.push(value),
    });

    await user.click(screen.getByRole('button', {name: /add new sample/i}));

    await waitFor(() => {
      expect(createRelatedRecord).toHaveBeenCalledTimes(1);
    });

    expect(createRelatedRecord.mock.calls[0][0]).toMatchObject({
      parentRecordId: 'parent-1',
      parentFieldId: 'samples',
      createdBy: 'user-1',
      parentFieldValue: [existing],
    });

    await waitFor(() => {
      expect(commit).toHaveBeenCalledTimes(1);
      expect(toRecord).toHaveBeenCalledWith(
        expect.objectContaining({recordId: 'sample-1', mode: 'new'})
      );
    });

    expect(setFieldDataValues.at(-1)).toEqual([existing, makeLink('sample-1')]);
  });

  it('uses the latest field value when creating multiple related records sequentially', async () => {
    const user = userEvent.setup();
    const existing = makeLink('sample-0');
    const setFieldDataValues: unknown[] = [];
    const createdIds: string[] = [];

    const createRelatedRecord = vi.fn(async ({parentFieldValue}) => {
      const prev = Array.isArray(parentFieldValue)
        ? (parentFieldValue as LinkEntry[])
        : [];
      const newId = `sample-${prev.length}`;
      createdIds.push(newId);
      const newLink = makeLink(newId);
      return {
        record: {_id: newId},
        linked: [...prev, newLink],
      };
    });

    const {commit} = renderRelatedRecordField({
      initialData: [existing],
      createRelatedRecord,
      onSetFieldData: value => setFieldDataValues.push(value),
    });

    await user.click(screen.getByRole('button', {name: /add new sample/i}));
    await waitFor(() => {
      expect(createRelatedRecord).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', {name: /add new sample/i}));
    await waitFor(() => {
      expect(createRelatedRecord).toHaveBeenCalledTimes(2);
    });

    expect(createRelatedRecord.mock.calls[0][0].parentFieldValue).toEqual([
      existing,
    ]);

    expect(createRelatedRecord.mock.calls[1][0].parentFieldValue).toEqual([
      existing,
      makeLink(createdIds[0]),
    ]);

    expect(setFieldDataValues.at(-1)).toEqual([
      existing,
      makeLink(createdIds[0]),
      makeLink(createdIds[1]),
    ]);

    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('shows an error and does not update field state when a single-value field rejects a second create', async () => {
    const user = userEvent.setup();
    const existing = makeLink('sample-0');
    const setFieldDataValues: unknown[] = [];

    const createRelatedRecord = vi.fn(async ({parentFieldValue}) => {
      if (!Array.isArray(parentFieldValue) && parentFieldValue) {
        throw new Error(
          'Field samples already holds a record and takes only one'
        );
      }
      const prev = Array.isArray(parentFieldValue)
        ? (parentFieldValue as LinkEntry[])
        : parentFieldValue
          ? [parentFieldValue as LinkEntry]
          : [];
      const newLink = makeLink('sample-1');
      return {
        record: {_id: newLink.record_id},
        linked: [...prev, newLink][0],
      };
    });

    const {commit, toRecord} = renderRelatedRecordField({
      initialData: existing,
      createRelatedRecord,
      onSetFieldData: value => setFieldDataValues.push(value),
      multiple: false,
    });

    await user.click(screen.getByRole('button', {name: /add new sample/i}));

    await waitFor(() => {
      expect(createRelatedRecord).toHaveBeenCalledTimes(1);
    });

    expect(createRelatedRecord.mock.calls[0][0].parentFieldValue).toEqual(
      existing
    );

    expect(await screen.findByText(/takes only one/i)).toBeInTheDocument();
    expect(setFieldDataValues).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
    expect(toRecord).not.toHaveBeenCalled();
  });

  it('creates the first related record when initialData is undefined and state.value is undefined', async () => {
    const user = userEvent.setup();
    const setFieldDataValues: unknown[] = [];

    const createRelatedRecord = vi.fn(
      async ({parentFieldValue: _parentFieldValue}) => {
        const newLink = makeLink('sample-1');
        return {
          record: {_id: newLink.record_id},
          linked: [newLink],
        };
      }
    );

    const {commit, toRecord} = renderRelatedRecordField({
      initialData: undefined,
      createRelatedRecord,
      onSetFieldData: value => setFieldDataValues.push(value),
      multiple: true,
      stateValueUndefined: true,
    });

    await user.click(screen.getByRole('button', {name: /add new sample/i}));

    await waitFor(() => {
      expect(createRelatedRecord).toHaveBeenCalledTimes(1);
    });

    expect(createRelatedRecord.mock.calls[0][0]).toMatchObject({
      parentRecordId: 'parent-1',
      parentFieldId: 'samples',
      createdBy: 'user-1',
      parentFieldValue: undefined,
    });

    await waitFor(() => {
      expect(commit).toHaveBeenCalledTimes(1);
      expect(toRecord).toHaveBeenCalledWith(
        expect.objectContaining({recordId: 'sample-1', mode: 'new'})
      );
    });

    expect(setFieldDataValues.at(-1)).toEqual([makeLink('sample-1')]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
