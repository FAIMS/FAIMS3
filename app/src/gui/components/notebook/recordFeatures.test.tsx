/**
 * Tests for record-feature hydration over a mixed notebook: a spatial form
 * (with a Map field) and a non-spatial form. Records of the spatial form
 * produce features; records of the non-spatial form must trigger no revision
 * fetch at all, asserted through a spied data engine.
 */
import {
  MinimalRecordMetadata,
  type CompiledNotebookUiSpec,
} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import React, {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getGISFieldsByForm, useRecordFeatures} from './recordFeatures';

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

/**
 * A two-form notebook: 'Site' carries a MapFormField, 'Observation' carries
 * only a text field. Mirrors the common parent-site / child-observation shape
 * where most records belong to the non-spatial form.
 */
const uiSpec = {
  fields: {
    site_location: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {},
    },
    obs_note: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {},
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
  conditional_sources: new Set<string>(),
} as unknown as CompiledNotebookUiSpec;

const makeRecord = (
  recordId: string,
  revisionId: string,
  type: string
): MinimalRecordMetadata =>
  ({
    projectId: 'test-project',
    recordId,
    revisionId,
    type,
    conflicts: false,
    deleted: false,
  }) as MinimalRecordMetadata;

const siteRecord = makeRecord('rec-site', 'frev-site', 'Site');
const obsRecord = makeRecord('rec-obs', 'frev-obs', 'Observation');

const recordTypes = ['Site', 'Observation'];

const wrapper = ({children}: {children: ReactNode}) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  getRevision.mockReset();
  getAvp.mockReset();
  getRevision.mockResolvedValue({avps: {site_location: 'avp-1'}});
  getAvp.mockResolvedValue({
    data: {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151.2, -33.9]},
      properties: null,
    },
  });
});

describe('getGISFieldsByForm', () => {
  it('maps each form to only its own GIS fields', () => {
    expect(getGISFieldsByForm(uiSpec)).toEqual({
      Site: ['site_location'],
      Observation: [],
    });
  });
});

describe('useRecordFeatures', () => {
  it('extracts spatial-form features and never fetches a revision for non-spatial-form records', async () => {
    const {result} = renderHook(
      () =>
        useRecordFeatures({
          projectId: 'test-project',
          uiSpec,
          records: [siteRecord, obsRecord],
          recordTypes,
        }),
      {wrapper}
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    const features = result.current.data!.features;
    expect(features).toHaveLength(1);
    expect(features[0].properties?.record_id).toBe('rec-site');

    expect(getRevision).toHaveBeenCalledTimes(1);
    expect(getRevision).toHaveBeenCalledWith('frev-site');
  });

  it('reads nothing when every record belongs to a non-spatial form', async () => {
    const {result} = renderHook(
      () =>
        useRecordFeatures({
          projectId: 'test-project',
          uiSpec,
          records: [obsRecord],
          recordTypes,
        }),
      {wrapper}
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.features).toHaveLength(0);
    expect(getRevision).not.toHaveBeenCalled();
    expect(getAvp).not.toHaveBeenCalled();
  });
});
