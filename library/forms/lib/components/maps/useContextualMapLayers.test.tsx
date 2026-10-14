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

function layer(visible: boolean): ContextualMapLayer {
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
  };
}

function MapHook({map}: {map: OlMap}) {
  useContextualMapLayers(map);
  return null;
}

function Harness({visible, map}: {visible: boolean; map: OlMap}) {
  const layers = useMemo(() => [layer(visible)], [visible]);
  return (
    <ContextualMapLayersContext.Provider
      value={{
        layers,
        updateLayer: () => undefined,
        moveLayer: () => undefined,
      }}
    >
      <MapHook map={map} />
    </ContextualMapLayersContext.Provider>
  );
}

describe('useContextualMapLayers', () => {
  it('drops a hidden overlay instead of keeping its data mounted', async () => {
    const added: BaseLayer[] = [];
    const removed: BaseLayer[] = [];
    const map = {
      addLayer: (value: BaseLayer) => {
        added.push(value);
      },
      removeLayer: (value: BaseLayer) => {
        removed.push(value);
      },
    } as unknown as OlMap;
    const view = render(<Harness visible map={map} />);
    await vi.waitFor(() => {
      expect(added).toHaveLength(1);
    });
    view.rerender(<Harness visible={false} map={map} />);
    expect(removed).toEqual(added);
  });
});
