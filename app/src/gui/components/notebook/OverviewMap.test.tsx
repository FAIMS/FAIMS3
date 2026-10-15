// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {
  compileUiSpecConditionals,
  type CompiledNotebookUiSpec,
  type NotebookUiSpec,
} from '@faims3/data-model';
import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {RecordFeatureCollection} from './recordFeatures';

const mapProps = vi.hoisted(() => ({
  current: undefined as
    | {
        recordLayers?: Array<{
          id: string;
          formId: string;
          name: string;
          kind: string;
          visible: boolean;
        }>;
        onUpdateRecordLayer?: (id: string, patch: {visible?: boolean}) => void;
      }
    | undefined,
}));

vi.mock('@faims3/forms', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/forms')>();
  return {
    ...actual,
    MapComponent: (props: (typeof mapProps)['current']) => {
      mapProps.current = props;
      return <div data-testid="overview-map" />;
    },
  };
});

vi.mock('../../../buildconfig', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../buildconfig')>();
  return {
    ...actual,
    getMapConfig: () => ({}),
  };
});

vi.mock('../../../context/notebookRoute', () => ({
  useNotebookRoute: () => ({
    notebook: {serverId: 'server', projectId: 'project-1'},
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({children}: {children: unknown}) => children,
}));

const features = vi.hoisted(() => ({
  current: {
    type: 'FeatureCollection',
    features: [],
  } as RecordFeatureCollection,
}));

vi.mock('./recordFeatures', () => ({
  groupRecordFeaturesByForm: (collection: RecordFeatureCollection) => {
    const grouped = new Map<string, RecordFeatureCollection['features']>();
    for (const feature of collection.features) {
      const formId = feature.properties.form_id;
      const list = grouped.get(formId) ?? [];
      list.push(feature);
      grouped.set(formId, list);
    }
    return new Map(
      [...grouped.entries()].map(([formId, items]) => [
        formId,
        {type: 'FeatureCollection' as const, features: items},
      ])
    );
  },
  useRecordFeatures: () => ({
    data: features.current,
    isLoading: false,
    isError: false,
    error: null,
    dataEngine: {},
    gisFields: ['site_location'],
  }),
}));

import {OverviewMap} from './OverviewMap';

const rawUiSpec: NotebookUiSpec = {
  fields: {
    site_location: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {name: 'site_location'},
    },
  },
  views: {
    'site-section': {fields: ['site_location']},
    'obs-section': {fields: ['site_location']},
  },
  viewsets: {
    Site: {views: ['site-section'], label: 'Sites'},
    Observation: {views: ['obs-section'], label: 'Observations'},
  },
  visible_types: ['Site', 'Observation'],
  settings: {showQrCodeButton: false},
  schemaVersion: '1',
};
compileUiSpecConditionals(rawUiSpec);
const uiSpec = rawUiSpec as CompiledNotebookUiSpec;

const feature = (
  formId: string,
  recordId: string
): RecordFeatureCollection['features'][number] => ({
  type: 'Feature',
  geometry: {type: 'Point', coordinates: [151.2, -33.9]},
  properties: {
    name: recordId,
    record_id: recordId,
    revision_id: `${recordId}-rev`,
    form_id: formId,
  },
});

describe('OverviewMap record layers', () => {
  beforeEach(() => {
    localStorage.clear();
    mapProps.current = undefined;
    features.current = {
      type: 'FeatureCollection',
      features: [feature('Site', 'site-1'), feature('Observation', 'obs-1')],
    };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('passes one styleable layer per form with spatial records to the map', () => {
    render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    const layers = mapProps.current?.recordLayers ?? [];
    expect(layers.map(layer => layer.name)).toEqual(['Observations', 'Sites']);
    expect(layers.every(layer => layer.kind === 'record-form')).toBe(true);
    expect(layers.every(layer => layer.visible)).toBe(true);
  });

  it('hides a form layer through the same panel patch path', () => {
    const {rerender} = render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    act(() => {
      mapProps.current?.onUpdateRecordLayer?.('record-form:Site', {
        visible: false,
      });
    });
    rerender(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    const site = mapProps.current?.recordLayers?.find(
      layer => layer.formId === 'Site'
    );
    expect(site?.visible).toBe(false);
    expect(
      JSON.parse(
        localStorage.getItem('map-record-form-prefs:project-1') ?? '{}'
      )['record-form:Site'].visible
    ).toBe(false);
  });
});
