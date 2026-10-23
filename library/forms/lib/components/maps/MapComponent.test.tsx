// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   MapComponent compass wiring: live-cursor triangle from mocked heading
 *   plus GPS, and the iOS Safari permission gesture on pointer down.
 */

import {Position} from '@capacitor/geolocation';
import {act, fireEvent, render, waitFor} from '@testing-library/react';
import Map from 'ol/Map';
import {RegularShape, Style} from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MapComponent} from './MapComponent';
import {MapConfig} from './types';

const headingState = vi.hoisted(() => ({
  headingDeg: 90 as number | null,
  source: 'compass' as 'compass' | null,
  reference: 'true' as 'true' | 'magnetic' | null,
  requestWebPermission: vi.fn(),
}));

const watchState = vi.hoisted(() => ({
  callback: undefined as
    | ((position: Position | null, err?: {message?: string}) => void)
    | undefined,
}));

vi.mock('../../hooks/useDeviceHeading', () => ({
  useDeviceHeading: () => ({
    headingDeg: headingState.headingDeg,
    source: headingState.source,
    reference: headingState.reference,
    requestWebPermission: headingState.requestWebPermission,
  }),
}));

vi.mock('../../hooks/useLocation', () => ({
  useCurrentLocation: () => ({data: undefined}),
  getCoordinates: (position?: Position) =>
    position
      ? [position.coords.longitude, position.coords.latitude]
      : undefined,
}));

vi.mock('./tileDB/TileStore', async () => {
  const {default: VectorLayer} = await import('ol/layer/Vector');
  const {default: VectorSource} = await import('ol/source/Vector');
  return {
    createTileStore: () => ({
      getTileLayer: () => new VectorLayer({source: new VectorSource()}),
      hasSatellite: () => false,
      getSatelliteLayer: () => undefined,
      getVectorZoomRange: () => [0, 20],
      getSatelliteZoomRange: () => [0, 20],
      getAttribution: () => '',
      getSatelliteAttribution: () => '',
    }),
  };
});

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    watchPosition: vi.fn(
      (
        _options: unknown,
        callback: (position: Position | null, err?: {message?: string}) => void
      ) => {
        watchState.callback = callback;
        return Promise.resolve('watch-1');
      }
    ),
    clearWatch: vi.fn().mockResolvedValue(undefined),
  },
}));

const MAP_CONFIG: MapConfig = {
  mapSource: 'osm',
  mapSourceKey: '',
  mapStyle: 'basic',
};

const SYDNEY: Position = {
  timestamp: Date.now(),
  coords: {
    latitude: -33.87,
    longitude: 151.21,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: 45,
    speed: null,
  },
};

function headingTriangle(map: Map): RegularShape | undefined {
  for (const layer of map.getLayers().getArray()) {
    if (layer.getZIndex() !== 999 || !(layer instanceof VectorLayer)) {
      continue;
    }
    const source = layer.getSource() as VectorSource | null;
    for (const feature of source?.getFeatures() ?? []) {
      const style = feature.getStyle();
      if (style instanceof Style) {
        const image = style.getImage();
        if (image instanceof RegularShape && image.getPoints() === 3) {
          return image;
        }
      }
    }
  }
  return undefined;
}

async function renderMap(): Promise<Map> {
  let created: Map | undefined;
  render(
    <div style={{width: 400, height: 400}}>
      <MapComponent
        config={MAP_CONFIG}
        parentSetMap={map => {
          created = map;
        }}
        center={[151.21, -33.87]}
        showControls={false}
        autoFlyToCurrentLocation={false}
      />
    </div>
  );

  await waitFor(() => {
    expect(created).toBeDefined();
  });
  return created!;
}

describe('MapComponent heading', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  beforeEach(() => {
    headingState.headingDeg = 90;
    headingState.source = 'compass';
    headingState.reference = 'true';
    headingState.requestWebPermission.mockReset();
    watchState.callback = undefined;
  });

  it('draws the live-cursor triangle from the mocked compass heading', async () => {
    const map = await renderMap();

    await act(async () => {
      watchState.callback?.(SYDNEY);
    });

    const triangle = headingTriangle(map);
    expect(triangle).toBeDefined();
    expect(triangle!.getRotation()).toBeCloseTo((90 * Math.PI) / 180 + Math.PI);
  });

  it('falls back to GPS heading when the compass is missing', async () => {
    headingState.headingDeg = null;
    headingState.source = null;
    headingState.reference = null;

    const map = await renderMap();

    await act(async () => {
      watchState.callback?.(SYDNEY);
    });

    const triangle = headingTriangle(map);
    expect(triangle).toBeDefined();
    expect(triangle!.getRotation()).toBeCloseTo((45 * Math.PI) / 180 + Math.PI);
  });

  it('hides the triangle until a GPS fix arrives', async () => {
    const map = await renderMap();
    expect(headingTriangle(map)).toBeUndefined();
  });

  it('requests web orientation permission on pointer down', async () => {
    const map = await renderMap();

    fireEvent.pointerDown(map.getTargetElement());

    expect(headingState.requestWebPermission).toHaveBeenCalledTimes(1);
  });
});
