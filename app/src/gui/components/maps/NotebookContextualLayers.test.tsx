// SPDX-License-Identifier: Apache-2.0
import type {ContextualMapLayer} from '@faims3/forms';
import {ContextualMapLayersContext} from '@faims3/forms';
import {act, render, screen} from '@testing-library/react';
import {useContext} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CONTEXTUAL_LAYERS_CHANGED_EVENT} from './contextualLayerStore';
import {NotebookContextualLayers} from './NotebookContextualLayers';

const harness = vi.hoisted(() => ({
  updateContextualLayerPrefs: vi.fn(async () => undefined),
  notifyContextualLayersChanged: vi.fn(),
  moveContextualLayer: vi.fn(async () => undefined),
  contextualLayersForMap: vi.fn(),
  resetContextualLayerPrefs: vi.fn(),
}));

vi.mock('./contextualLayerStore', () => ({
  CONTEXTUAL_LAYERS_CHANGED_EVENT: 'contextual-layers-changed',
  contextualLayersForMap: harness.contextualLayersForMap,
  updateContextualLayerPrefs: harness.updateContextualLayerPrefs,
  notifyContextualLayersChanged: harness.notifyContextualLayersChanged,
  moveContextualLayer: harness.moveContextualLayer,
  resetContextualLayerPrefs: harness.resetContextualLayerPrefs,
}));

const storedLayer: ContextualMapLayer = {
  id: 'boundary',
  name: 'Site boundary',
  kind: 'vector-tiles',
  url: 'blob:boundary',
  visible: true,
  opacity: 1,
  zIndex: 1,
  stroke: '#1565c0',
  fill: '#1565c080',
  lineWidth: 2,
  pointSize: 6,
  extent4326: [0, 0, 1, 1],
};

function DragOpacity() {
  const {updateLayer, layers} = useContext(ContextualMapLayersContext);
  return (
    <>
      <span>{layers.find(layer => layer.id === 'boundary')?.opacity}</span>
      <button
        type="button"
        onClick={() => {
          updateLayer('boundary', {opacity: 0.2});
          updateLayer('boundary', {opacity: 0.5});
          updateLayer('boundary', {opacity: 0.8});
        }}
      >
        Drag opacity
      </button>
    </>
  );
}

function StackSlot() {
  const {updateLayer, layers} = useContext(ContextualMapLayersContext);
  return (
    <>
      <span data-testid="z">
        {layers.find(layer => layer.id === 'boundary')?.zIndex}
      </span>
      <button
        type="button"
        onClick={() => updateLayer('boundary', {zIndex: 5})}
      >
        Raise
      </button>
    </>
  );
}

function ResetPaint() {
  const {resetLayers, updateLayer, layers} = useContext(
    ContextualMapLayersContext
  );
  const layer = layers.find(item => item.id === 'boundary');
  return (
    <>
      <span data-testid="opacity">{layer?.opacity}</span>
      <span data-testid="z">{layer?.zIndex}</span>
      <span data-testid="stroke">{layer?.stroke}</span>
      <button
        type="button"
        onClick={() => updateLayer('boundary', {opacity: 0.2})}
      >
        Fade
      </button>
      <button type="button" onClick={resetLayers}>
        Reset
      </button>
    </>
  );
}

describe('NotebookContextualLayers', () => {
  beforeEach(() => {
    harness.updateContextualLayerPrefs.mockClear();
    harness.notifyContextualLayersChanged.mockClear();
    harness.resetContextualLayerPrefs.mockReset();
    harness.resetContextualLayerPrefs.mockReturnValue({
      boundary: {
        visible: true,
        opacity: 0.85,
        zIndex: 10,
        stroke: '#1565c0',
        fill: '#1565c040',
        lineWidth: 2,
        pointSize: 6,
      },
    });
    harness.contextualLayersForMap.mockReset();
    harness.contextualLayersForMap.mockResolvedValue([{...storedLayer}]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the dragged opacity on screen and writes it once', async () => {
    render(
      <NotebookContextualLayers projectId="survey">
        <DragOpacity />
      </NotebookContextualLayers>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      screen.getByRole('button', {name: 'Drag opacity'}).click();
    });

    expect(screen.getByText('0.8')).toBeTruthy();
    expect(harness.updateContextualLayerPrefs).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(harness.updateContextualLayerPrefs).toHaveBeenCalledTimes(1);
    expect(harness.updateContextualLayerPrefs).toHaveBeenCalledWith(
      'boundary',
      {
        opacity: 0.8,
      }
    );
  });

  it('does not let a listing started before a raise overwrite the panel', async () => {
    const pendingLoads: Array<(layers: ContextualMapLayer[]) => void> = [];
    harness.contextualLayersForMap.mockImplementation(
      () =>
        new Promise<ContextualMapLayer[]>(resolve => {
          pendingLoads.push(resolve);
        })
    );

    render(
      <NotebookContextualLayers projectId="survey">
        <StackSlot />
      </NotebookContextualLayers>
    );

    await act(async () => {
      pendingLoads[0]!([{...storedLayer, zIndex: 1}]);
    });
    expect(screen.getByTestId('z').textContent).toBe('1');

    await act(async () => {
      dispatchEvent(
        new CustomEvent(CONTEXTUAL_LAYERS_CHANGED_EVENT, {
          detail: {projectId: 'survey'},
        })
      );
    });

    await act(async () => {
      screen.getByRole('button', {name: 'Raise'}).click();
    });
    expect(screen.getByTestId('z').textContent).toBe('5');

    await act(async () => {
      pendingLoads[1]!([{...storedLayer, zIndex: 1}]);
    });
    expect(screen.getByTestId('z').textContent).toBe('5');
  });

  it('applies file defaults immediately and drops pending paint edits', async () => {
    render(
      <NotebookContextualLayers projectId="survey">
        <ResetPaint />
      </NotebookContextualLayers>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('opacity').textContent).toBe('1');
    expect(screen.getByTestId('z').textContent).toBe('1');

    await act(async () => {
      screen.getByRole('button', {name: 'Fade'}).click();
    });
    expect(screen.getByTestId('opacity').textContent).toBe('0.2');

    await act(async () => {
      screen.getByRole('button', {name: 'Reset'}).click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(screen.getByTestId('opacity').textContent).toBe('0.85');
    expect(screen.getByTestId('z').textContent).toBe('10');
    expect(screen.getByTestId('stroke').textContent).toBe('#1565c0');
    expect(harness.resetContextualLayerPrefs).toHaveBeenCalledWith('survey');
    expect(harness.notifyContextualLayersChanged).toHaveBeenCalledWith(
      'survey'
    );
    expect(harness.updateContextualLayerPrefs).not.toHaveBeenCalled();
  });
});
