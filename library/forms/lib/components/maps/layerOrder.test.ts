// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {moveStackedLayer, sortLayersTopFirst} from './layerOrder';

function layer(id: string, zIndex: number) {
  return {id, zIndex};
}

describe('moveStackedLayer', () => {
  it('swaps unique neighbours without rewriting the rest of the stack', () => {
    const layers = [layer('low', 1), layer('high', 2), layer('base', 0)];
    expect(moveStackedLayer(layers, 'low', 'up')).toEqual([
      layer('low', 2),
      layer('high', 1),
      layer('base', 0),
    ]);
  });

  it('raises a tied layer that a z-value swap would leave stuck', () => {
    const layers = [
      layer('streets', 0),
      layer('tracks', 10),
      layer('boundary', 10),
    ];
    const names = (stack: {id: string; zIndex: number}[]) =>
      sortLayersTopFirst(stack).map(item => item.id);

    expect(names(layers)).toEqual(['tracks', 'boundary', 'streets']);

    const raised = moveStackedLayer(layers, 'boundary', 'up');
    expect(names(raised)).toEqual(['boundary', 'tracks', 'streets']);
    expect(raised.find(item => item.id === 'boundary')!.zIndex).toBeGreaterThan(
      raised.find(item => item.id === 'tracks')!.zIndex
    );
  });

  it('does not move the layer already at the top of the panel', () => {
    const layers = [layer('top', 2), layer('bottom', 1)];
    expect(moveStackedLayer(layers, 'top', 'up')).toBe(layers);
  });
});
