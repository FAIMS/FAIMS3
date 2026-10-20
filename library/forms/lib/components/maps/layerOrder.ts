// SPDX-License-Identifier: Apache-2.0

/**
 * Panel stack order. Higher zIndex draws and lists above. The raise/lower
 * buttons walk this visual list — they must not only swap stored z values,
 * because a tied pair then stays put.
 */

export type StackedLayer = {
  id: string;
  zIndex: number;
};

/** Finite zIndex, or 0 when the stored value is not a number. */
function stackValue(zIndex: number): number {
  return Number.isFinite(zIndex) ? zIndex : 0;
}

/** True when every layer has a distinct stack value. */
function zValuesAreUnique<T extends StackedLayer>(layers: T[]): boolean {
  const seen = new Set<number>();
  for (const layer of layers) {
    const zIndex = stackValue(layer.zIndex);
    if (seen.has(zIndex)) {
      return false;
    }
    seen.add(zIndex);
  }
  return true;
}

/** Highest zIndex first. Equal values keep the incoming order. */
export function sortLayersTopFirst<T extends StackedLayer>(layers: T[]): T[] {
  return layers
    .map((layer, index) => ({layer, index}))
    .sort((a, b) => {
      const delta = stackValue(b.layer.zIndex) - stackValue(a.layer.zIndex);
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map(({layer}) => layer);
}

/** Unique zIndex 0..n-1 for a top-first list. Top of the panel is n-1. */
export function rankLayersTopFirst<T extends StackedLayer>(topFirst: T[]): T[] {
  const top = topFirst.length - 1;
  return topFirst.map((layer, index) => {
    const zIndex = top - index;
    return stackValue(layer.zIndex) === zIndex ? layer : {...layer, zIndex};
  });
}

/**
 * Move one step in the panel. `up` is toward the top of the list.
 * Unique stacks keep their z values and only swap the pair. A tied stack is
 * re-ranked so the layer actually changes place.
 */
export function moveStackedLayer<T extends StackedLayer>(
  layers: T[],
  id: string,
  direction: 'up' | 'down'
): T[] {
  const ordered = sortLayersTopFirst(layers);
  const index = ordered.findIndex(layer => layer.id === id);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= ordered.length) {
    return layers;
  }

  const current = ordered[index];
  const other = ordered[swapWith];
  if (
    stackValue(current.zIndex) !== stackValue(other.zIndex) &&
    zValuesAreUnique(layers)
  ) {
    return layers.map(layer => {
      if (layer.id === current.id) {
        return {...layer, zIndex: other.zIndex};
      }
      if (layer.id === other.id) {
        return {...layer, zIndex: current.zIndex};
      }
      return layer;
    });
  }

  const next = [...ordered];
  next[index] = other;
  next[swapWith] = current;
  return rankLayersTopFirst(next);
}
