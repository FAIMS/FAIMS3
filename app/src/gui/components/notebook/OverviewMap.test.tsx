// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {
  compileUiSpecConditionals,
  type CompiledNotebookUiSpec,
  type NotebookUiSpec,
} from '@faims3/data-model';
import {act, render, screen} from '@testing-library/react';
import {useContext, type ReactNode} from 'react';
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
        onResetRecordLayers?: () => void;
      }
    | undefined,
  mounts: 0,
}));

vi.mock('@faims3/forms', async importOriginal => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('@faims3/forms')>();
  return {
    ...actual,
    MapComponent: (props: (typeof mapProps)['current']) => {
      mapProps.current = props;
      React.useEffect(() => {
        mapProps.mounts += 1;
      }, []);
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
  data: {
    type: 'FeatureCollection',
    features: [],
  } as RecordFeatureCollection | undefined,
  isLoading: false,
  isError: false,
  error: null as Error | null,
}));

vi.mock('./recordFeatures', () => ({
  useRecordFeatures: () => ({
    data: features.data,
    isLoading: features.isLoading,
    isError: features.isError,
    error: features.error,
    dataEngine: {},
    gisFields: ['site_location'],
  }),
}));

import {
  MapComponent,
  RecordFormMapLayersContext,
  useRecordFormLayerList,
} from '@faims3/forms';
import {OverviewMap} from './OverviewMap';

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

/**
 * Notebook-route record-layer source (same as NotebookRecordMapLayers).
 * OverviewMap and MapWrapper both read this context for prefs.
 */
function SharedRecordFormLayers({children}: {children: ReactNode}) {
  const list = useRecordFormLayerList({
    projectId: 'project-1',
    descriptors: [
      {formId: 'Observation', name: 'Observations'},
      {formId: 'Site', name: 'Sites'},
    ],
    colorFormIds: ['Site', 'Observation'],
  });
  return (
    <RecordFormMapLayersContext.Provider
      value={{
        collection: {
          type: 'FeatureCollection',
          features: [
            feature('Site', 'site-1'),
            feature('Observation', 'obs-1'),
          ],
        },
        recordLayers: list.recordLayers,
        overviewMapTypes: ['Site', 'Observation'],
        updateRecordLayer: list.updateRecordLayer,
        resetRecordLayers: list.resetRecordLayers,
      }}
    >
      {children}
    </RecordFormMapLayersContext.Provider>
  );
}

/** Same context → recordLayers / onUpdateRecordLayer wiring as MapWrapper. */
function CollectionPopup() {
  const layers = useContext(RecordFormMapLayersContext);
  return (
    <MapComponent
      config={{} as never}
      parentSetMap={() => undefined}
      recordLayers={layers.recordLayers}
      onUpdateRecordLayer={layers.updateRecordLayer}
      onResetRecordLayers={layers.resetRecordLayers}
    />
  );
}

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

describe('OverviewMap record layers', () => {
  beforeEach(() => {
    localStorage.clear();
    mapProps.current = undefined;
    mapProps.mounts = 0;
    features.isLoading = false;
    features.isError = false;
    features.error = null;
    features.data = {
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

  it('hides a record-form layer on OverviewMap after the popup onUpdateRecordLayer', () => {
    const {unmount} = render(
      <SharedRecordFormLayers>
        <CollectionPopup />
      </SharedRecordFormLayers>
    );
    act(() => {
      mapProps.current?.onUpdateRecordLayer?.('record-form:Site', {
        visible: false,
      });
    });
    unmount();

    render(
      <SharedRecordFormLayers>
        <OverviewMap
          uiSpec={uiSpec}
          project_id="project-1"
          records={{allRecords: []}}
        />
      </SharedRecordFormLayers>
    );

    expect(
      mapProps.current?.recordLayers?.find(layer => layer.formId === 'Site')
        ?.visible
    ).toBe(false);
    expect(
      mapProps.current?.recordLayers?.find(
        layer => layer.formId === 'Observation'
      )?.visible
    ).toBe(true);
  });

  it('hides a record-form layer on the collection popup after OverviewMap onUpdateRecordLayer', () => {
    const {unmount} = render(
      <SharedRecordFormLayers>
        <OverviewMap
          uiSpec={uiSpec}
          project_id="project-1"
          records={{allRecords: []}}
        />
      </SharedRecordFormLayers>
    );
    act(() => {
      mapProps.current?.onUpdateRecordLayer?.('record-form:Site', {
        visible: false,
      });
    });
    unmount();

    render(
      <SharedRecordFormLayers>
        <CollectionPopup />
      </SharedRecordFormLayers>
    );

    expect(
      mapProps.current?.recordLayers?.find(layer => layer.formId === 'Site')
        ?.visible
    ).toBe(false);
    expect(
      mapProps.current?.recordLayers?.find(
        layer => layer.formId === 'Observation'
      )?.visible
    ).toBe(true);
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

  it('restores default record-layer paint when the panel resets', () => {
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
    expect(
      mapProps.current?.recordLayers?.find(layer => layer.formId === 'Site')
        ?.visible
    ).toBe(false);

    act(() => {
      mapProps.current?.onResetRecordLayers?.();
    });
    rerender(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    const layers = mapProps.current?.recordLayers ?? [];
    expect(layers.every(layer => layer.visible)).toBe(true);
    expect(
      JSON.parse(
        localStorage.getItem('map-record-form-prefs:project-1') ?? '{}'
      )
    ).toEqual({});
  });

  it('shows the map when there are no records with location data', () => {
    features.data = {type: 'FeatureCollection', features: []};

    render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    expect(
      screen.queryByText(/No records with location data/)
    ).not.toBeInTheDocument();
    expect(mapProps.current?.recordLayers).toEqual([]);
  });

  it('shows the map while the first record features are still loading', () => {
    features.isLoading = true;
    features.data = undefined;

    render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    expect(screen.queryByText(/Loading map data/)).not.toBeInTheDocument();
  });

  it('shows an error instead of an empty map when hydration fails', () => {
    features.isError = true;
    features.error = new Error('database is closed');
    features.data = undefined;

    render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.queryByTestId('overview-map')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Failed to load map data: database is closed/)
    ).toBeInTheDocument();
  });

  it('keeps the map mounted when a newly synced record hydrates', () => {
    const {rerender} = render(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );
    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    expect(mapProps.mounts).toBe(1);

    features.isLoading = true;
    features.data = undefined;
    rerender(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    expect(mapProps.mounts).toBe(1);

    features.isLoading = false;
    features.data = {
      type: 'FeatureCollection',
      features: [
        feature('Site', 'site-1'),
        feature('Observation', 'obs-1'),
        feature('Site', 'site-2'),
      ],
    };
    rerender(
      <OverviewMap
        uiSpec={uiSpec}
        project_id="project-1"
        records={{allRecords: []}}
      />
    );

    expect(screen.getByTestId('overview-map')).toBeInTheDocument();
    expect(mapProps.mounts).toBe(1);
    expect(
      mapProps.current?.recordLayers?.map(layer => layer.formId).sort()
    ).toEqual(['Observation', 'Site']);
  });
});
