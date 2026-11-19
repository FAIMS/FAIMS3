// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  RECORD_FORM_LAYER_KIND,
  readRecordFormLayerPrefs,
  type RecordFormLayer,
} from '../../../components/maps/recordFormLayers';
import {
  RecordFormMapLayersContext,
  type RecordFeatureCollection,
  type RecordFormMapLayersValue,
} from '../../../components/maps/recordFormMapLayers';
import {useRecordFormLayerList} from '../../../components/maps/useRecordFormLayerList';
import MapWrapper from './MapWrapper';

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
}));

vi.mock('../../../components/maps/MapComponent', () => ({
  MapComponent: (props: (typeof mapProps)['current']) => {
    mapProps.current = props;
    return <div data-testid="collection-map" />;
  },
}));

vi.mock('../../../components/maps/useRecordFormLayersPlot', () => ({
  useRecordFormLayersPlot: () => undefined,
}));

const theme = createTheme();

function recordLayer(
  formId: string,
  name: string,
  visible = true
): RecordFormLayer {
  return {
    id: `record-form:${formId}`,
    formId,
    name,
    kind: RECORD_FORM_LAYER_KIND,
    visible,
    opacity: 1,
    zIndex: 980,
    stroke: '#2171b5',
    fill: '#2171b580',
    lineWidth: 4,
    pointSize: 7,
  };
}

const collection: RecordFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151.2, -33.9]},
      properties: {
        name: 'site-1',
        record_id: 'site-1',
        revision_id: 'site-1-rev',
        form_id: 'Site',
      },
    },
  ],
};

function contextValue(
  layers: RecordFormLayer[],
  extra?: Partial<RecordFormMapLayersValue>
): RecordFormMapLayersValue {
  return {
    collection,
    recordLayers: layers,
    overviewMapTypes: ['Site', 'Observation'],
    updateRecordLayer: extra?.updateRecordLayer ?? (() => undefined),
    resetRecordLayers: extra?.resetRecordLayers ?? (() => undefined),
    ...extra,
  };
}

async function openMap() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name: 'Select Point'}));
  expect(await screen.findByTestId('collection-map')).toBeInTheDocument();
}

function renderWrapper({
  layers = [
    recordLayer('Site', 'Sites'),
    recordLayer('Observation', 'Observations'),
  ],
  includeRecordLayers = true,
  excludeRecordId,
  value,
}: {
  layers?: RecordFormLayer[];
  includeRecordLayers?: boolean;
  excludeRecordId?: string;
  value?: RecordFormMapLayersValue;
} = {}) {
  const context = value ?? contextValue(layers);
  render(
    <ThemeProvider theme={theme}>
      <RecordFormMapLayersContext.Provider value={context}>
        <MapWrapper
          config={{mapSource: 'osm', mapSourceKey: '', mapStyle: 'basic'}}
          label="Select Point"
          features={undefined}
          featureType="Point"
          zoom={14}
          center={[151.2, -33.87]}
          setFeatures={vi.fn()}
          setNoPermission={vi.fn()}
          isLocationSelected={false}
          includeRecordLayers={includeRecordLayers}
          excludeRecordId={excludeRecordId}
        />
      </RecordFormMapLayersContext.Provider>
    </ThemeProvider>
  );
  return context;
}

describe('MapWrapper record layers', () => {
  beforeEach(() => {
    localStorage.clear();
    mapProps.current = undefined;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('passes record-form layers into MapComponent in full collection mode', async () => {
    renderWrapper();
    await openMap();

    const layers = mapProps.current?.recordLayers ?? [];
    expect(layers).toHaveLength(2);
    expect(layers.every(layer => layer.kind === 'record-form')).toBe(true);
    expect(layers.map(layer => layer.id)).toEqual([
      'record-form:Site',
      'record-form:Observation',
    ]);
    expect(layers.map(layer => layer.name)).toEqual(['Sites', 'Observations']);
  });

  it('omits a form that displayInOverviewMap excluded from the shared list', async () => {
    renderWrapper({layers: [recordLayer('Site', 'Sites')]});
    await openMap();

    expect(mapProps.current?.recordLayers?.map(layer => layer.formId)).toEqual([
      'Site',
    ]);
    expect(
      mapProps.current?.recordLayers?.some(
        layer => layer.formId === 'Observation'
      )
    ).toBe(false);
  });

  it('opens and stays drawable when no collected records have geometry', async () => {
    renderWrapper({
      value: contextValue([], {
        collection: {type: 'FeatureCollection', features: []},
      }),
    });
    await openMap();

    expect(screen.getByTestId('collection-map')).toBeInTheDocument();
    expect(mapProps.current?.recordLayers).toEqual([]);
    expect(
      screen.queryByText(/failed to load map data/i)
    ).not.toBeInTheDocument();
  });

  it('does not pass record-form layers in Designer preview', async () => {
    renderWrapper({
      includeRecordLayers: false,
      layers: [recordLayer('Site', 'Sites')],
    });
    await openMap();

    expect(mapProps.current?.recordLayers).toEqual([]);
    expect(mapProps.current?.onUpdateRecordLayer).toBeUndefined();
  });

  it('writes hide/show to the shared map-record-form-prefs key', async () => {
    function PrefsHost() {
      const list = useRecordFormLayerList({
        projectId: 'project-1',
        descriptors: [{formId: 'Site', name: 'Sites'}],
        colorFormIds: ['Site'],
      });
      return (
        <RecordFormMapLayersContext.Provider
          value={{
            collection,
            recordLayers: list.recordLayers,
            overviewMapTypes: ['Site'],
            updateRecordLayer: list.updateRecordLayer,
            resetRecordLayers: list.resetRecordLayers,
          }}
        >
          <MapWrapper
            config={{mapSource: 'osm', mapSourceKey: '', mapStyle: 'basic'}}
            label="Select Point"
            features={undefined}
            featureType="Point"
            zoom={14}
            center={[151.2, -33.87]}
            setFeatures={vi.fn()}
            setNoPermission={vi.fn()}
            isLocationSelected={false}
            includeRecordLayers
          />
        </RecordFormMapLayersContext.Provider>
      );
    }

    render(
      <ThemeProvider theme={theme}>
        <PrefsHost />
      </ThemeProvider>
    );
    await openMap();

    act(() => {
      mapProps.current?.onUpdateRecordLayer?.('record-form:Site', {
        visible: false,
      });
    });

    expect(
      readRecordFormLayerPrefs('project-1')['record-form:Site'].visible
    ).toBe(false);
    expect(
      mapProps.current?.recordLayers?.find(layer => layer.formId === 'Site')
        ?.visible
    ).toBe(false);
  });
});
