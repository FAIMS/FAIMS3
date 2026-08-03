/**
 * Tests for record-feature hydration over a mixed notebook: a spatial form
 * (with a Map field) and a non-spatial form.
 *
 * The central case is the one that makes the read notebook-wide rather than
 * per-form: a record whose GIS field is no longer reachable from its own form
 * (moved to another form, or dropped from every view) must still plot, because
 * its AVP still holds the geometry.
 */
import {
  compileUiSpecConditionals,
  DocumentNotFoundError,
  MinimalRecordMetadata,
  type CompiledNotebookUiSpec,
  type NotebookUiSpec,
} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import React, {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getGISFields, useRecordFeatures} from './recordFeatures';

const {getRevision, getAvp} = vi.hoisted(() => ({
  getRevision: vi.fn(),
  getAvp: vi.fn(),
}));

vi.mock('@faims3/data-model', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/data-model')>();
  return {
    ...actual,
    DataEngine: class {
      core = {getRevision, getAvp};
    },
  };
});

vi.mock('../../../utils/database', () => ({
  localGetDataDb: () => ({}),
}));

const POINT_FEATURE = {
  type: 'Feature',
  geometry: {type: 'Point', coordinates: [151.2, -33.9]},
  properties: null,
};

/**
 * A two-form notebook: 'Site' carries a MapFormField, 'Observation' carries
 * only a text field. Mirrors the common parent-site / child-observation shape
 * where most records belong to the non-spatial form.
 *
 * `orphan_location` is a spatial field that no view references, standing in for
 * a field moved to another form or dropped from its section after capture.
 */
const rawUiSpec: NotebookUiSpec = {
  fields: {
    site_location: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {name: 'site_location'},
    },
    orphan_location: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {name: 'orphan_location'},
    },
    obs_note: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {name: 'obs_note'},
    },
  },
  views: {
    'site-section': {fields: ['site_location']},
    'obs-section': {fields: ['obs_note']},
  },
  viewsets: {
    Site: {views: ['site-section']},
    Observation: {views: ['obs-section']},
  },
  visible_types: ['Site', 'Observation'],
  settings: {showQrCodeButton: false},
  schemaVersion: '1',
};
compileUiSpecConditionals(rawUiSpec);
// Same cast as the app's compiledSpecService: the compiler attaches its
// artifacts in place
const uiSpec = rawUiSpec as CompiledNotebookUiSpec;

const makeRecord = (
  recordId: string,
  revisionId: string,
  type: string
): MinimalRecordMetadata => ({
  projectId: 'test-project',
  recordId,
  revisionId,
  type,
  created: new Date(0),
  createdBy: 'tester',
  updated: new Date(0),
  updatedBy: 'tester',
  conflicts: false,
  deleted: false,
});

const siteRecord = makeRecord('rec-site', 'frev-site', 'Site');
const obsRecord = makeRecord('rec-obs', 'frev-obs', 'Observation');

const recordTypes = ['Site', 'Observation'];

// No retry override here: the hook sets `retry: 2` explicitly, which wins over
// any client default, so failing-query tests must budget for its backoff.
const wrapper = ({children}: {children: ReactNode}) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

/** Render the hook over `records` and wait for the query to settle. */
const renderFeatures = async (records: MinimalRecordMetadata[] | undefined) => {
  const {result} = renderHook(
    () =>
      useRecordFeatures({
        projectId: 'test-project',
        uiSpec,
        records,
        recordTypes,
      }),
    {wrapper}
  );
  await waitFor(() => expect(result.current.data).toBeDefined());
  return result;
};

beforeEach(() => {
  getRevision.mockReset();
  getAvp.mockReset();
  getRevision.mockResolvedValue({avps: {site_location: 'avp-1'}});
  getAvp.mockResolvedValue({data: POINT_FEATURE});
});

describe('getGISFields', () => {
  it('returns every spatial field in the notebook, reachable from a view or not', () => {
    expect(getGISFields(uiSpec).sort()).toEqual([
      'orphan_location',
      'site_location',
    ]);
  });
});

describe('useRecordFeatures', () => {
  it('extracts a feature tagged with its owning record', async () => {
    const result = await renderFeatures([siteRecord]);

    const features = result.current.data!.features;
    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({
      name: 'rec-site',
      record_id: 'rec-site',
      revision_id: 'frev-site',
      form_id: 'Site',
    });
    expect(getRevision).toHaveBeenCalledWith('frev-site');
  });

  it('still plots geometry held in a field its form no longer references', async () => {
    // The Observation form has no spatial field, but this record's AVPs carry
    // one — the field was moved away or dropped from the section after capture.
    getRevision.mockResolvedValue({avps: {orphan_location: 'avp-orphan'}});

    const result = await renderFeatures([obsRecord]);

    expect(result.current.data!.features).toHaveLength(1);
    expect(result.current.data!.features[0].properties?.record_id).toBe(
      'rec-obs'
    );
  });

  it('expands a FeatureCollection into one feature per member', async () => {
    getAvp.mockResolvedValue({
      data: {
        type: 'FeatureCollection',
        features: [POINT_FEATURE, POINT_FEATURE],
      },
    });

    const result = await renderFeatures([siteRecord]);

    expect(result.current.data!.features).toHaveLength(2);
  });

  it('skips a malformed GIS value without failing the query', async () => {
    getAvp.mockResolvedValue({data: {type: 'Feature', geometry: null}});

    const result = await renderFeatures([siteRecord]);

    expect(result.current.data!.features).toHaveLength(0);
    expect(result.current.isError).toBe(false);
  });

  it('keeps other records when one revision is missing', async () => {
    getRevision.mockImplementation((revisionId: string) =>
      revisionId === 'frev-obs'
        ? Promise.reject(new DocumentNotFoundError(revisionId))
        : Promise.resolve({avps: {site_location: 'avp-1'}})
    );

    const result = await renderFeatures([siteRecord, obsRecord]);

    expect(result.current.isError).toBe(false);
    expect(result.current.data!.features).toHaveLength(1);
    expect(result.current.data!.features[0].properties?.record_id).toBe(
      'rec-site'
    );
  });

  it('skips only the field whose AVP is missing', async () => {
    getRevision.mockResolvedValue({
      avps: {site_location: 'avp-gone', orphan_location: 'avp-ok'},
    });
    getAvp.mockImplementation((avpId: string) =>
      avpId === 'avp-gone'
        ? Promise.reject(new DocumentNotFoundError(avpId))
        : Promise.resolve({data: POINT_FEATURE})
    );

    const result = await renderFeatures([siteRecord]);

    expect(result.current.isError).toBe(false);
    expect(result.current.data!.features).toHaveLength(1);
  });

  // The hook's `retry: 2` costs a fixed 1s + 2s of backoff before the query
  // settles, which overruns vitest's 5s default, so this case buys more room.
  it('surfaces a systemic AVP read failure instead of showing an empty map', async () => {
    getAvp.mockRejectedValue(new Error('database is closed'));

    const {result} = renderHook(
      () =>
        useRecordFeatures({
          projectId: 'test-project',
          uiSpec,
          records: [siteRecord],
          recordTypes,
        }),
      {wrapper}
    );

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 15000,
    });
    expect(result.current.data).toBeUndefined();
  }, 20000);

  // The hook's `retry: 2` costs a fixed 1s + 2s of backoff before the query
  // settles, which overruns vitest's 5s default, so this case buys more room.
  it('surfaces a systemic read failure instead of showing an empty map', async () => {
    // A database that will not open must not look like "no geometry here"
    getRevision.mockRejectedValue(new Error('database is closed'));

    const {result} = renderHook(
      () =>
        useRecordFeatures({
          projectId: 'test-project',
          uiSpec,
          records: [siteRecord],
          recordTypes,
        }),
      {wrapper}
    );

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 15000,
    });
    expect(result.current.data).toBeUndefined();
  }, 20000);

  it('stays disabled and touches no database when there are no records', async () => {
    const {result} = renderHook(
      () =>
        useRecordFeatures({
          projectId: 'test-project',
          uiSpec,
          records: undefined,
          recordTypes,
        }),
      {wrapper}
    );

    // The query is gated off, so it never resolves to a collection at all
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect(getRevision).not.toHaveBeenCalled();
    expect(getAvp).not.toHaveBeenCalled();
  });
});
