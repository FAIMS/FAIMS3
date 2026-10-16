// SPDX-License-Identifier: Apache-2.0
import {
  ContextualMapLayersContext,
  moveStackedLayer,
  type ContextualMapLayer,
  type ContextualMapLayerPatch,
} from '@faims3/forms';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CONTEXTUAL_LAYERS_CHANGED_EVENT,
  contextualLayersForMap,
  moveContextualLayer,
  notifyContextualLayersChanged,
  resetContextualLayerPrefs,
  updateContextualLayerPrefs,
} from './contextualLayerStore';

/** Wait for a drag or keystroke to settle before writing the index document. */
const PREFS_WRITE_DELAY_MS = 150;

/** Shares one notebook's downloaded layers with every map on that screen. */
export function NotebookContextualLayers({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [layers, setLayers] = useState<ContextualMapLayer[]>([]);
  const pendingPatches = useRef(new Map<string, ContextualMapLayerPatch>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const flushing = useRef(false);
  // Drop listings that started before a local edit. On Android, resolving
  // file URIs is slow enough that an older reload can finish after a raise
  // and put the row back where it was.
  const loadGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const stored = await contextualLayersForMap(projectId);
    if (generation !== loadGeneration.current) {
      return;
    }
    const pending = pendingPatches.current;
    setLayers(
      stored.map(layer =>
        pending.has(layer.id) ? {...layer, ...pending.get(layer.id)} : layer
      )
    );
  }, [projectId]);

  const flushPatches = useCallback(async () => {
    if (flushing.current) {
      return;
    }
    flushing.current = true;
    let failed = false;
    try {
      while (pendingPatches.current.size > 0 && !failed) {
        const batch = new Map(pendingPatches.current);
        pendingPatches.current.clear();
        for (const [id, patch] of batch) {
          try {
            await updateContextualLayerPrefs(id, patch);
          } catch (error) {
            console.error(error);
            const newer = pendingPatches.current.get(id);
            pendingPatches.current.set(id, {...patch, ...newer});
            failed = true;
            break;
          }
        }
      }
      if (!failed) {
        notifyContextualLayersChanged(projectId);
      }
    } finally {
      flushing.current = false;
    }
    if (!failed && pendingPatches.current.size > 0) {
      void flushPatches();
    }
  }, [projectId]);

  const queuePatch = useCallback(
    (id: string, patch: ContextualMapLayerPatch) => {
      const existing = pendingPatches.current.get(id);
      pendingPatches.current.set(id, {...existing, ...patch});
      if (flushTimer.current !== undefined) {
        clearTimeout(flushTimer.current);
      }
      flushTimer.current = setTimeout(() => {
        flushTimer.current = undefined;
        void flushPatches();
      }, PREFS_WRITE_DELAY_MS);
    },
    [flushPatches]
  );

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

  useEffect(() => {
    return () => {
      if (flushTimer.current !== undefined) {
        clearTimeout(flushTimer.current);
      }
      const pending = new Map(pendingPatches.current);
      pendingPatches.current.clear();
      for (const [id, patch] of pending) {
        void updateContextualLayerPrefs(id, patch);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      layers,
      updateLayer: (id: string, patch: ContextualMapLayerPatch) => {
        loadGeneration.current += 1;
        setLayers(current =>
          current.map(layer => (layer.id === id ? {...layer, ...patch} : layer))
        );
        queuePatch(id, patch);
      },
      moveLayer: (id: string, direction: 'up' | 'down') => {
        loadGeneration.current += 1;
        setLayers(current => moveStackedLayer(current, id, direction));
        void moveContextualLayer(projectId, id, direction).then(() => {
          notifyContextualLayersChanged(projectId);
        });
      },
      resetLayers: () => {
        loadGeneration.current += 1;
        pendingPatches.current.clear();
        if (flushTimer.current !== undefined) {
          clearTimeout(flushTimer.current);
          flushTimer.current = undefined;
        }
        const prefs = resetContextualLayerPrefs(projectId);
        setLayers(current =>
          current.map(layer => {
            const next = prefs[layer.id];
            return next
              ? {
                  ...layer,
                  visible: next.visible,
                  opacity: next.opacity,
                  zIndex: next.zIndex,
                  stroke: next.stroke,
                  fill: next.fill,
                  lineWidth: next.lineWidth,
                  pointSize: next.pointSize,
                  labelField: next.labelField,
                }
              : layer;
          })
        );
        notifyContextualLayersChanged(projectId);
      },
    }),
    [layers, projectId, queuePatch]
  );

  return (
    <ContextualMapLayersContext.Provider value={value}>
      {children}
    </ContextualMapLayersContext.Provider>
  );
}
