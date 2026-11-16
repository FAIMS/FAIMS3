// SPDX-License-Identifier: Apache-2.0
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {render} from '@testing-library/react';
import type {Map as OlMap} from 'ol';
import type BaseLayer from 'ol/layer/Base';
import {useMemo} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
} from './contextualMapLayers';
import {useContextualMapLayers} from './useContextualMapLayers';

const archive = readFileSync(
  path.join(process.cwd(), 'lib/components/maps/fixtures/points.pmtiles')
);

function layer(
  visible: boolean,
  patch: Partial<ContextualMapLayer> = {}
): ContextualMapLayer {
  return {
    id: 'boundary',
    name: 'Boundary',
    kind: 'vector-tiles',
    url: 'blob:boundary',
    readTileBytes: (offset, length) =>
      Promise.resolve(
        Uint8Array.from(archive.subarray(offset, offset + length)).buffer
      ),
    visible,
    opacity: 1,
    zIndex: 1,
    stroke: '#1565c0',
    fill: '#1565c040',
    lineWidth: 2,
    pointSize: 6,
    extent4326: [0, 0, 1, 1],
    ...patch,
  };
}

function MapHook({map}: {map: OlMap}) {
  const {layerErrors} = useContextualMapLayers(map);
  return (
    <div>
      {Object.entries(layerErrors).map(([id, message]) => (
        <p key={id}>{`${id}: ${message}`}</p>
      ))}
    </div>
  );
}

function Harness({
  visible,
  map,
  overlay,
}: {
  visible: boolean;
  map: OlMap;
  overlay?: ContextualMapLayer;
}) {
  const layers = useMemo(() => [overlay ?? layer(visible)], [overlay, visible]);
  return (
    <ContextualMapLayersContext.Provider
      value={{
        layers,
        updateLayer: () => undefined,
        moveLayer: () => undefined,
        resetLayers: () => undefined,
      }}
    >
      <MapHook map={map} />
    </ContextualMapLayersContext.Provider>
  );
}

function stubMap() {
  const added: BaseLayer[] = [];
  const removed: BaseLayer[] = [];
  const map = {
    addLayer: (value: BaseLayer) => {
      added.push(value);
    },
    removeLayer: (value: BaseLayer) => {
      removed.push(value);
    },
    on: () => undefined,
    un: () => undefined,
    render: () => undefined,
    getView: () => ({getInteracting: () => false}),
  } as unknown as OlMap;
  return {map, added, removed};
}

describe('useContextualMapLayers', () => {
  it('drops a hidden overlay instead of keeping its data mounted', async () => {
    const {map, added, removed} = stubMap();
    const view = render(<Harness visible map={map} />);
    await vi.waitFor(() => {
      expect(added).toHaveLength(1);
    });
    view.rerender(<Harness visible={false} map={map} />);
    expect(removed).toEqual(added);
  });

  it('records a create failure so the layers panel can show it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const {map, added} = stubMap();
    const {getByText} = render(
      <Harness
        visible
        map={map}
        overlay={layer(true, {readTileBytes: undefined})}
      />
    );
    await vi.waitFor(() => {
      expect(
        getByText('boundary: Layer Boundary has no tile reader.')
      ).toBeTruthy();
    });
    expect(added).toHaveLength(0);
    spy.mockRestore();
  });
});
