// SPDX-License-Identifier: Apache-2.0

/**
 * Per-project record-form layer list: merge descriptors with stored paint
 * prefs so the overview map and the collection popup share hide/show/style.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  applyRecordFormLayerPatch,
  buildRecordFormLayers,
  defaultRecordFormLayerPrefs,
  formIdFromRecordFormLayerId,
  prefsFromRecordFormLayer,
  readRecordFormLayerPrefs,
  writeRecordFormLayerPrefs,
  type RecordFormLayerDescriptor,
  type RecordFormLayerPatch,
} from './recordFormLayers';

/**
 * Build styleable `record-form:<formId>` rows and persist panel patches under
 * `map-record-form-prefs:<projectId>`.
 */
export function useRecordFormLayerList({
  projectId,
  descriptors,
  colorFormIds,
}: {
  projectId: string;
  descriptors: RecordFormLayerDescriptor[];
  colorFormIds: string[];
}) {
  const [prefs, setPrefs] = useState(() => readRecordFormLayerPrefs(projectId));

  useEffect(() => {
    setPrefs(readRecordFormLayerPrefs(projectId));
  }, [projectId]);

  const recordLayers = useMemo(
    () => buildRecordFormLayers(descriptors, prefs, colorFormIds),
    [colorFormIds, descriptors, prefs]
  );
  const recordLayersRef = useRef(recordLayers);
  recordLayersRef.current = recordLayers;

  const updateRecordLayer = useCallback(
    (id: string, patch: RecordFormLayerPatch) => {
      setPrefs(current => {
        const layer = recordLayersRef.current.find(item => item.id === id);
        const formId = layer?.formId ?? formIdFromRecordFormLayerId(id) ?? id;
        const fallback = layer
          ? prefsFromRecordFormLayer(layer)
          : defaultRecordFormLayerPrefs(formId, colorFormIds, 0);
        const next = applyRecordFormLayerPatch(current, id, patch, fallback);
        writeRecordFormLayerPrefs(projectId, next);
        return next;
      });
    },
    [colorFormIds, projectId]
  );

  const resetRecordLayers = useCallback(() => {
    writeRecordFormLayerPrefs(projectId, {});
    setPrefs({});
  }, [projectId]);

  return {recordLayers, updateRecordLayer, resetRecordLayers};
}
