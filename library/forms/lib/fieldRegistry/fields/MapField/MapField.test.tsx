// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from '../../../components/maps/contextualMapLayers';
import {MapFormField} from './index';

const getTileSets = vi.fn(async (): Promise<Array<{setName: string}>> => []);

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {getCurrentPosition: vi.fn()},
}));

vi.mock('../../../components/maps/tileDB/TileStore', () => ({
  createTileStore: () => ({
    getTileSets,
  }),
}));

const wrapperProps = vi.hoisted(() => ({
  current: undefined as
    | {
        label: string;
        includeRecordLayers?: boolean;
        excludeRecordId?: string;
      }
    | undefined,
}));

vi.mock('./MapWrapper', () => ({
  default: (props: {
    label: string;
    includeRecordLayers?: boolean;
    excludeRecordId?: string;
  }) => {
    wrapperProps.current = props;
    return <button type="button">{props.label}</button>;
  },
}));

function downloadedLayer(): ContextualMapLayer {
  return {
    id: 'layer-1',
    name: 'Survey overlay',
    kind: 'vector-tiles',
    url: 'blob:layer',
    visible: true,
    opacity: 1,
    zIndex: 1,
    stroke: '#1565c0',
    fill: '#1565c040',
    lineWidth: 2,
    pointSize: 6,
    extent4326: [140, -38, 141, -37],
  };
}

function renderMapField({
  online,
  layers = [],
  featureType = 'Point',
  mode = 'full',
}: {
  online: boolean;
  layers?: ContextualMapLayer[];
  featureType?: 'Point' | 'Polygon' | 'LineString';
  mode?: 'full' | 'preview';
}) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  });

  render(
    <ContextualMapLayersContext.Provider
      value={{
        layers,
        updateLayer: () => undefined,
        moveLayer: () => undefined,
        resetLayers: () => undefined,
      }}
    >
      <MapFormField
        name="location"
        fieldId="location"
        label="Location"
        buttonLabelText="Select Point"
        required={false}
        helperText=""
        advancedHelperText=""
        disabled={false}
        featureType={featureType}
        allowSetToCurrentPoint={false}
        center={[151.2, -33.87]}
        state={{value: {data: undefined}, meta: {errors: []}} as never}
        setFieldData={vi.fn()}
        setFieldAnnotation={vi.fn()}
        addAttachment={vi.fn(async () => 'attachment-id')}
        removeAttachment={vi.fn(async () => undefined)}
        handleBlur={vi.fn()}
        trigger={{commit: vi.fn(async () => undefined)}}
        config={
          (mode === 'full'
            ? {
                mode: 'full',
                appName: 'test-app',
                recordId: 'record-1',
                mapConfig: () => ({
                  mapSource: 'osm',
                  mapSourceKey: '',
                  mapStyle: 'osm',
                }),
              }
            : {
                mode: 'preview',
                mapConfig: () => ({
                  mapSource: 'osm',
                  mapSourceKey: '',
                  mapStyle: 'osm',
                }),
              }) as never
        }
      />
    </ContextualMapLayersContext.Provider>
  );
}

describe('MapFormField offline availability', () => {
  beforeEach(() => {
    getTileSets.mockReset();
    getTileSets.mockResolvedValue([]);
    wrapperProps.current = undefined;
  });

  it('offers map edits while online even with nothing downloaded', async () => {
    renderMapField({online: true});

    expect(
      await screen.findByRole('button', {name: 'Select Point'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not available while/, {exact: false})
    ).not.toBeInTheDocument();
  });

  it('hides map edits while offline when nothing is downloaded', async () => {
    renderMapField({online: false});

    expect(
      await screen.findByText(/no downloaded map or map layer on this device/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Select Point'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Use my current location'})
    ).toBeInTheDocument();
  });

  it('offers map edits while offline when any offline map region is downloaded', async () => {
    getTileSets.mockResolvedValue([{setName: 'field-site'}]);
    renderMapField({online: false});

    expect(
      await screen.findByRole('button', {name: 'Select Point'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no downloaded map or map layer on this device/i)
    ).not.toBeInTheDocument();
  });

  it('offers map edits while offline when any map layer is downloaded', async () => {
    renderMapField({online: false, layers: [downloadedLayer()]});

    expect(
      await screen.findByRole('button', {name: 'Select Point'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no downloaded map or map layer on this device/i)
    ).not.toBeInTheDocument();
    expect(getTileSets).not.toHaveBeenCalled();
  });

  it('asks the collection popup for record layers in full mode', async () => {
    renderMapField({online: true});

    expect(
      await screen.findByRole('button', {name: 'Select Point'})
    ).toBeInTheDocument();
    expect(wrapperProps.current?.includeRecordLayers).toBe(true);
    expect(wrapperProps.current?.excludeRecordId).toBe('record-1');
  });

  it('does not request record layers in Designer preview', async () => {
    renderMapField({online: true, mode: 'preview'});

    expect(
      await screen.findByRole('button', {name: 'Select Point'})
    ).toBeInTheDocument();
    expect(wrapperProps.current?.includeRecordLayers).toBe(false);
    expect(wrapperProps.current?.excludeRecordId).toBeUndefined();
  });

  it('hides polygon edits while offline when nothing is downloaded', async () => {
    renderMapField({online: false, featureType: 'Polygon'});

    expect(
      await screen.findByText(/no downloaded map or map layer on this device/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Use my current location'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Select Polygon'})
    ).not.toBeInTheDocument();
  });
});
