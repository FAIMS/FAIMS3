// SPDX-License-Identifier: Apache-2.0
import {
  ContextualMapLayersContext,
  type ContextualMapLayerPatch,
} from '@faims3/forms';
import {ReactNode, useCallback, useEffect, useMemo, useState} from 'react';
import type {ContextualMapLayer} from '@faims3/forms';
import {
  CONTEXTUAL_LAYERS_CHANGED_EVENT,
  contextualLayersForMap,
  moveContextualLayer,
  notifyContextualLayersChanged,
  updateContextualLayerPrefs,
} from './contextualLayerStore';

/** Shares one notebook's downloaded layers with every map on that screen. */
export function NotebookContextualLayers({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [layers, setLayers] = useState<ContextualMapLayer[]>([]);

  const reload = useCallback(async () => {
    setLayers(await contextualLayersForMap(projectId));
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{projectId?: string}>).detail;
      if (detail?.projectId === projectId) {
        void reload();
      }
    };
    addEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
    return () => removeEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
  }, [projectId, reload]);

  const value = useMemo(
    () => ({
      layers,
      updateLayer: (id: string, patch: ContextualMapLayerPatch) => {
        void updateContextualLayerPrefs(id, patch).then(async () => {
          notifyContextualLayersChanged(projectId);
          await reload();
        });
      },
      moveLayer: (id: string, direction: 'up' | 'down') => {
        void moveContextualLayer(projectId, id, direction).then(async () => {
          notifyContextualLayersChanged(projectId);
          await reload();
        });
      },
    }),
    [layers, projectId, reload]
  );

  return (
    <ContextualMapLayersContext.Provider value={value}>
      {children}
    </ContextualMapLayersContext.Provider>
  );
}
